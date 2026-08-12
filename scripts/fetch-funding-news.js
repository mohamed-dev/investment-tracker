import { pathToFileURL } from 'url';
import Parser from 'rss-parser';
import { supabase } from '../lib/supabase.js';
import { sources, fundingKeywords } from './sources.js';

const parser = new Parser();

function stripHtml(text) {
  return text ? text.replace(/<[^>]*>/g, '') : text;
}

function looksLikeFunding(text) {
  const lower = text.toLowerCase();
  return fundingKeywords.some((kw) => lower.includes(kw));
}

// crude first-pass extraction, good enough to get rows into the DB fast.
// you review/clean in the dashboard rather than trying to parse perfectly here.
function guessCompanyName(headline) {
  // most funding headlines start with "CompanyName raises $X million..."
  const match = headline.match(/^([A-Z][\w.& ]{1,40}?)\s+(raises|secures|closes|lands|launches|unveils|announces|nets|wins)/i);
  return match ? match[1].trim() : headline.slice(0, 60);
}

const AMOUNT_PATTERN = /\$([\d,.]+)\s?(million|billion|M|B)/gi;
const FUNDING_WORDS = /\b(raised|raises|funding|round|investment|secures|closes|lands|nets|wins)\b/i;
const AMOUNT_PROXIMITY_CHARS = 40; // how close a funding word must be to the $ amount

function guessAmount(text) {
  AMOUNT_PATTERN.lastIndex = 0;
  let match;

  while ((match = AMOUNT_PATTERN.exec(text)) !== null) {
    const windowStart = Math.max(0, match.index - AMOUNT_PROXIMITY_CHARS);
    const windowEnd = Math.min(text.length, match.index + match[0].length + AMOUNT_PROXIMITY_CHARS);
    const nearbyText = text.slice(windowStart, windowEnd);

    if (!FUNDING_WORDS.test(nearbyText)) continue;

    let num = parseFloat(match[1].replace(/,/g, ''));
    const unit = match[2].toLowerCase();
    if (unit.startsWith('b')) num *= 1000;
    return num; // amount in millions
  }

  return null;
}

async function runForSource(source) {
  let fetched = 0;
  let inserted = 0;
  let status = 'ok';
  let errorMessage = null;

  try {
    if (source.url.startsWith('REPLACE')) {
      console.log(`Skipping ${source.name}, no feed URL set yet`);
      return;
    }

    const feed = await parser.parseURL(source.url);
    fetched = feed.items.length;

    for (const item of feed.items) {
      const text = `${stripHtml(item.title)} ${item.contentSnippet || ''}`;
      if (!looksLikeFunding(text)) continue;

      const companyName = guessCompanyName(stripHtml(item.title));
      const amount = guessAmount(text);

      // upsert company
      const { data: company } = await supabase
        .from('companies')
        .upsert({ name: companyName, region: source.region }, { onConflict: 'name' })
        .select()
        .single();

      if (!company) continue;

      // avoid duplicate rounds from the same source url
      const { data: existing } = await supabase
        .from('funding_rounds')
        .select('id')
        .eq('source_url', item.link)
        .maybeSingle();

      if (existing) continue;

      const { error } = await supabase.from('funding_rounds').insert({
        company_id: company.id,
        amount_usd: amount ? amount * 1_000_000 : null,
        announced_date: item.pubDate ? new Date(item.pubDate) : new Date(),
        source_url: item.link,
        source_name: source.name,
        raw_headline: stripHtml(item.title),
        region: source.region,
        content_snippet: item.contentSnippet || item.content || null,
        enrichment_status: 'pending',
      });

      if (!error) inserted += 1;
    }
  } catch (err) {
    status = 'error';
    errorMessage = err.message;
    console.error(`Error fetching ${source.name}:`, err.message);
  }

  await supabase.from('ingestion_log').insert({
    source_name: source.name,
    items_fetched: fetched,
    items_inserted: inserted,
    status,
    error_message: errorMessage,
  });
}

export async function runAllSources() {
  for (const source of sources) {
    await runForSource(source);
  }
}

// allow running directly with: node scripts/fetch-funding-news.js
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAllSources().then(() => {
    console.log('Done');
    process.exit(0);
  });
}

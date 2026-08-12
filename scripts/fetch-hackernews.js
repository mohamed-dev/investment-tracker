import { pathToFileURL } from 'url';
import { supabase } from '../lib/supabase.js';

const HN_API = 'https://hn.algolia.com/api/v1/search';
const queries = ['raises', 'seed round', 'show hn startup', 'pre-seed'];
const THREE_DAYS_SECONDS = 3 * 24 * 60 * 60;

const signalWords = [
  'startup', 'funding', 'raise', 'raised', 'seed', 'series', 'saas',
  'launch', 'beta', 'waitlist', 'founder', 'venture', 'valuation',
  'acquired', 'acquisition',
];

function looksRelevant(text) {
  const lower = text.toLowerCase();
  return signalWords.some((kw) => lower.includes(kw));
}

function stripHtml(text) {
  return text ? text.replace(/<[^>]*>/g, '').trim() : text;
}

// most funding headlines start with "CompanyName raises $X million..."
function guessCompanyName(title) {
  const match = title.match(/^([A-Z][\w.& ]{1,40}?)\s+(raises|secures|closes|lands)/i);
  return match ? match[1].trim() : title.slice(0, 60);
}

function guessRegion(text) {
  const lower = text.toLowerCase();
  if (lower.includes('saudi')) return 'saudi';
  if (['mena', 'uae', 'dubai', 'emirates', 'qatar', 'egypt', 'jordan', 'bahrain', 'kuwait'].some((kw) => lower.includes(kw))) {
    return 'mena';
  }
  return 'other';
}

async function searchQuery(query) {
  const createdAfter = Math.floor(Date.now() / 1000) - THREE_DAYS_SECONDS;
  const url = `${HN_API}?query=${encodeURIComponent(query)}&tags=story&numericFilters=created_at_i%3E${createdAfter}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HN Algolia API returned ${response.status}`);
  }

  const json = await response.json();
  return json.hits || [];
}

export async function runHackerNews() {
  let fetched = 0;
  let inserted = 0;
  let status = 'ok';
  let errorMessage = null;

  try {
    const seen = new Set();
    const hits = [];

    for (const query of queries) {
      const results = await searchQuery(query);
      for (const hit of results) {
        if (!hit.title || seen.has(hit.objectID)) continue;
        seen.add(hit.objectID);
        hits.push(hit);
      }
    }

    fetched = hits.length;

    for (const hit of hits) {
      const title = stripHtml(hit.title);
      const snippet = stripHtml(hit.story_text) || stripHtml(hit.comment_text) || null;
      const sourceUrl = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
      const text = `${title} ${snippet || ''}`;

      if (!looksRelevant(text)) continue;

      const { data: existing } = await supabase
        .from('funding_rounds')
        .select('id')
        .eq('source_url', sourceUrl)
        .maybeSingle();

      if (existing) continue;

      const companyName = guessCompanyName(title);

      const { data: company } = await supabase
        .from('companies')
        .upsert({ name: companyName, region: guessRegion(text) }, { onConflict: 'name' })
        .select()
        .single();

      if (!company) continue;

      const { error } = await supabase.from('funding_rounds').insert({
        company_id: company.id,
        amount_usd: null,
        announced_date: hit.created_at ? new Date(hit.created_at) : new Date(),
        source_url: sourceUrl,
        source_name: 'Hacker News',
        raw_headline: title,
        region: guessRegion(text),
        content_snippet: snippet,
        enrichment_status: 'pending',
      });

      if (!error) inserted += 1;
    }
  } catch (err) {
    status = 'error';
    errorMessage = err.message;
    console.error('Error fetching Hacker News:', err.message);
  }

  await supabase.from('ingestion_log').insert({
    source_name: 'Hacker News',
    items_fetched: fetched,
    items_inserted: inserted,
    status,
    error_message: errorMessage,
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runHackerNews().then(() => {
    console.log('Done');
    process.exit(0);
  });
}

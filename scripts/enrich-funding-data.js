import { supabase } from '../lib/supabase.js';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-haiku-4-5-20251001';

function stripHtml(text) {
  return text ? text.replace(/<[^>]*>/g, '').trim() : text;
}

async function fetchArticleText(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InvestmentTrackerBot/1.0)' },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const html = await res.text();
    const withoutScripts = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '');
    const text = stripHtml(withoutScripts).replace(/\s+/g, ' ').trim();

    return text.slice(0, 3000);
  } catch (err) {
    return null;
  }
}

async function classifyRound(row) {
  const articleText = await fetchArticleText(row.source_url);
  const contextText = articleText || row.content_snippet || 'none available';

  const prompt = `You're extracting structured data from a startup funding news article for an investment tracker used by a product manager evaluating market opportunities. Based on the text given, extract:

- summary: 2-3 sentences on what the company's product actually does, who it serves, and what problem it solves. Be specific if the article has detail, otherwise say what's known plainly. If truly nothing usable, say "Not enough information available."
- sector: best guess category, e.g. "fintech", "AI/ML tooling", "healthtech", "logistics", "e-commerce", "insurtech", "edtech", "gaming", "proptech", "contech", "other"
- is_ai_saas: true only if the company is clearly an AI-powered SaaS product, false otherwise
- investors: comma separated list of investor/fund names mentioned, or "not mentioned"
- funding_stage: seed, pre-seed, series a, series b, series c, growth, or "not specified"
- tech_notes: any technical/product detail mentioned, e.g. platform type, integrations, what they built, or "none mentioned"

Headline: ${stripHtml(row.raw_headline)}

Article text: ${contextText}

Respond ONLY with a JSON object with these exact keys: summary, sector, is_ai_saas, investors, funding_stage, tech_notes. No markdown, no explanation.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json();
  const textBlock = data.content?.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('No text response from Claude');

  const cleaned = textBlock.text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}

export async function runEnrichment({ reprocessAll = false } = {}) {
  let query = supabase
    .from('funding_rounds')
    .select('id, raw_headline, content_snippet, source_url');

  if (reprocessAll) {
    query = query.in('enrichment_status', ['pending', 'processed']);
  } else {
    query = query.eq('enrichment_status', 'pending');
  }

  const { data: rows, error } = await query.limit(30);

  if (error) {
    console.error('Failed to fetch rows:', error.message);
    return;
  }

  console.log(`Enriching ${rows.length} rows`);

  for (const row of rows) {
    try {
      const result = await classifyRound(row);

      await supabase
        .from('funding_rounds')
        .update({
          raw_headline: stripHtml(row.raw_headline),
          summary: result.summary,
          sector: result.sector,
          is_ai_saas: result.is_ai_saas,
          extracted_investors: result.investors,
          funding_stage: result.funding_stage,
          tech_notes: result.tech_notes,
          enrichment_status: 'processed',
        })
        .eq('id', row.id);

      console.log(`Enriched: ${stripHtml(row.raw_headline).slice(0, 60)}`);
    } catch (err) {
      console.error(`Failed to enrich row ${row.id}:`, err.message);
      await supabase
        .from('funding_rounds')
        .update({ enrichment_status: 'failed' })
        .eq('id', row.id);
    }
  }

  console.log('Enrichment done');
}

if (
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/'))
) {
  const reprocessAll = process.argv.includes('--all');
  runEnrichment({ reprocessAll }).then(() => process.exit(0));
}

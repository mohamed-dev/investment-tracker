import { supabase } from '../lib/supabase.js';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-haiku-4-5-20251001';

async function classifyRound(row) {
  const text = `Headline: ${row.raw_headline}\n\nSnippet: ${row.content_snippet || 'none available'}`;

  const prompt = `You're extracting structured data from a startup funding news item for an investment tracker. Based ONLY on the text given, extract:

- summary: one sentence on what the company actually does (product/service), in plain terms. If not enough info, say "Not enough information in snippet."
- sector: best guess category, e.g. "fintech", "AI/ML tooling", "healthtech", "logistics", "e-commerce", "insurtech", "edtech", "gaming", "other"
- is_ai_saas: true only if the company is clearly an AI-powered SaaS product, false otherwise
- investors: comma separated list of investor/fund names mentioned, or "not mentioned"
- funding_stage: seed, pre-seed, series a, series b, series c, growth, or "not specified"
- tech_notes: any technical detail mentioned (what tech they use, what they built), or "none mentioned"

${text}

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
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json();
  const textBlock = data.content?.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('No text response from Claude');

  const cleaned = textBlock.text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}

export async function runEnrichment() {
  const { data: rows, error } = await supabase
    .from('funding_rounds')
    .select('id, raw_headline, content_snippet')
    .eq('enrichment_status', 'pending')
    .limit(30);

  if (error) {
    console.error('Failed to fetch pending rows:', error.message);
    return;
  }

  console.log(`Enriching ${rows.length} rows`);

  for (const row of rows) {
    try {
      const result = await classifyRound(row);

      await supabase
        .from('funding_rounds')
        .update({
          summary: result.summary,
          sector: result.sector,
          is_ai_saas: result.is_ai_saas,
          extracted_investors: result.investors,
          funding_stage: result.funding_stage,
          tech_notes: result.tech_notes,
          enrichment_status: 'processed',
        })
        .eq('id', row.id);
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

if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/'))) {
  runEnrichment().then(() => process.exit(0));
}

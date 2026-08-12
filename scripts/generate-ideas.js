import { pathToFileURL } from 'url';
import { supabase } from '../lib/supabase.js';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-sonnet-4-6';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const TWENTY_HOURS_MS = 20 * 60 * 60 * 1000;

function formatAmount(amountUsd) {
  return amountUsd ? `$${(amountUsd / 1_000_000).toFixed(1)}M` : 'undisclosed amount';
}

async function alreadyRanToday() {
  const cutoff = new Date(Date.now() - TWENTY_HOURS_MS).toISOString();
  const { data, error } = await supabase
    .from('idea_suggestions')
    .select('id')
    .gte('created_at', cutoff)
    .limit(1);

  if (error) {
    console.error('Failed to check idea_suggestions history:', error.message);
    return false;
  }

  return data.length > 0;
}

async function fetchRecentRounds() {
  const cutoffDate = new Date(Date.now() - SEVEN_DAYS_MS).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('funding_rounds')
    .select('id, region, sector, summary, amount_usd, announced_date, companies(name)')
    .eq('enrichment_status', 'processed')
    .or('is_relevant.eq.true,is_relevant.is.null')
    .gte('announced_date', cutoffDate)
    .order('region', { ascending: true })
    .order('sector', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch recent rounds: ${error.message}`);
  }

  return (data || []).filter((row) => row.companies?.name && row.summary);
}

function buildPromptList(rounds) {
  const byRegion = {};
  for (const round of rounds) {
    const region = round.region || 'other';
    byRegion[region] = byRegion[region] || [];
    byRegion[region].push(round);
  }

  const sections = Object.keys(byRegion)
    .sort()
    .map((region) => {
      const lines = byRegion[region].map((round) => {
        const company = round.companies.name;
        const sector = round.sector || 'unspecified sector';
        const amount = formatAmount(round.amount_usd);
        return `- ${company} (${sector}, ${amount}): ${round.summary}`;
      });
      return `=== ${region.toUpperCase()} ===\n${lines.join('\n')}`;
    });

  return sections.join('\n\n');
}

function buildCompanyRoundMap(rounds) {
  const map = new Map();
  for (const round of rounds) {
    const key = round.companies.name.trim().toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(round.id);
  }
  return map;
}

async function callClaude(compactList) {
  const prompt = `You are a product strategist for Mefan, a company that builds AI and digital products for the marketing, media, and communication ecosystem, based in Saudi Arabia/GCC. Here is a list of startup funding events from the last 7 days across Saudi, MENA, USA, and Europe:

${compactList}

Based on patterns across these, and gaps you notice (e.g. something well-funded in the US/Europe with no GCC equivalent, or a recurring theme across multiple deals), suggest 3-5 concrete product ideas Mefan could realistically build within 2-4 weeks as an MVP. For each: give a short title, a 2-3 sentence rationale explaining what pattern or gap you're responding to and which specific funding events informed it, and which existing funding_round entries are most related. Respond as a JSON array of objects with keys: title, rationale, based_on_region, based_on_sector, source_company_names (array of company names from the input list that this idea references).

Respond ONLY with the JSON array. No markdown, no explanation.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`Anthropic API error: ${data.error.message}`);
  }

  const textBlock = data.content?.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('No text response from Claude');

  const cleaned = textBlock.text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}

export async function runGenerateIdeas() {
  if (await alreadyRanToday()) {
    console.log('Skipping idea generation, already ran within the last 20 hours');
    return;
  }

  const rounds = await fetchRecentRounds();

  if (rounds.length === 0) {
    console.log('No enriched funding rounds in the last 7 days, skipping idea generation');
    return;
  }

  console.log(`Generating ideas from ${rounds.length} funding rounds`);

  const compactList = buildPromptList(rounds);
  const companyRoundMap = buildCompanyRoundMap(rounds);

  let ideas;
  try {
    ideas = await callClaude(compactList);
  } catch (err) {
    console.error('Failed to generate ideas:', err.message);
    return;
  }

  let inserted = 0;

  for (const idea of ideas) {
    const sourceRoundIds = new Set();
    for (const name of idea.source_company_names || []) {
      const normalizedName = name.trim().toLowerCase();
      for (const [key, ids] of companyRoundMap.entries()) {
        if (key.includes(normalizedName) || normalizedName.includes(key)) {
          ids.forEach((id) => sourceRoundIds.add(id));
        }
      }
    }

    const { error } = await supabase.from('idea_suggestions').insert({
      title: idea.title,
      rationale: idea.rationale,
      based_on_region: idea.based_on_region,
      based_on_sector: idea.based_on_sector,
      source_round_ids: Array.from(sourceRoundIds),
    });

    if (error) {
      console.error(`Failed to insert idea "${idea.title}":`, error.message);
      continue;
    }

    inserted += 1;
    console.log(`Idea: ${idea.title}`);
    console.log(`  Rationale: ${idea.rationale}`);
    console.log(`  Region/Sector: ${idea.based_on_region || 'n/a'} / ${idea.based_on_sector || 'n/a'}`);
    console.log(`  Sources: ${(idea.source_company_names || []).join(', ')} (${sourceRoundIds.size} matched rounds)`);
  }

  console.log(`Inserted ${inserted} idea suggestions`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runGenerateIdeas().then(() => process.exit(0));
}

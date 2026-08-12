import { pathToFileURL } from 'url';
import { supabase } from '../lib/supabase.js';

// Product Hunt's v2 GraphQL API requires a developer token even for public
// read-only queries. Get one free at https://www.producthunt.com/v2/oauth/applications
// (create an application, then use its "Developer Token") and set it as
// PRODUCTHUNT_TOKEN in your env. Without it, this source is skipped.
const PRODUCTHUNT_TOKEN = process.env.PRODUCTHUNT_TOKEN;
const PRODUCTHUNT_API = 'https://api.producthunt.com/v2/api/graphql';

const matchKeywords = ['ai', 'saas', 'marketing', 'mena', 'saudi'];

function looksRelevant(text) {
  const lower = text.toLowerCase();
  return matchKeywords.some((kw) => lower.includes(kw));
}

function guessRegion(text) {
  const lower = text.toLowerCase();
  if (lower.includes('saudi')) return 'saudi';
  if (['mena', 'uae', 'dubai', 'emirates', 'qatar', 'egypt', 'jordan', 'bahrain', 'kuwait'].some((kw) => lower.includes(kw))) {
    return 'mena';
  }
  return 'other';
}

async function fetchTodaysLaunches() {
  const query = `
    query TodaysLaunches {
      posts(order: RANKING, first: 30) {
        edges {
          node {
            name
            tagline
            description
            url
            website
            createdAt
          }
        }
      }
    }
  `;

  const response = await fetch(PRODUCTHUNT_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${PRODUCTHUNT_TOKEN}`,
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`Product Hunt API returned ${response.status}`);
  }

  const json = await response.json();
  if (json.errors) {
    throw new Error(json.errors.map((e) => e.message).join('; '));
  }

  return (json.data?.posts?.edges || []).map((edge) => edge.node);
}

export async function runProductHunt() {
  let fetched = 0;
  let inserted = 0;
  let status = 'ok';
  let errorMessage = null;

  try {
    if (!PRODUCTHUNT_TOKEN) {
      console.log('Skipping Product Hunt, no PRODUCTHUNT_TOKEN set yet');
      return;
    }

    const posts = await fetchTodaysLaunches();
    fetched = posts.length;

    for (const post of posts) {
      const text = `${post.tagline} ${post.description || ''}`;
      if (!looksRelevant(text)) continue;

      const sourceUrl = post.website || post.url;

      const { data: existing } = await supabase
        .from('funding_rounds')
        .select('id')
        .eq('source_url', sourceUrl)
        .maybeSingle();

      if (existing) continue;

      const { data: company } = await supabase
        .from('companies')
        .upsert({ name: post.name, region: guessRegion(text) }, { onConflict: 'name' })
        .select()
        .single();

      if (!company) continue;

      const { error } = await supabase.from('funding_rounds').insert({
        company_id: company.id,
        amount_usd: null,
        announced_date: post.createdAt ? new Date(post.createdAt) : new Date(),
        source_url: sourceUrl,
        source_name: 'Product Hunt',
        raw_headline: `${post.name} — ${post.tagline}`,
        region: guessRegion(text),
        content_snippet: post.description || null,
        enrichment_status: 'pending',
      });

      if (!error) inserted += 1;
    }
  } catch (err) {
    status = 'error';
    errorMessage = err.message;
    console.error('Error fetching Product Hunt:', err.message);
  }

  if (PRODUCTHUNT_TOKEN) {
    await supabase.from('ingestion_log').insert({
      source_name: 'Product Hunt',
      items_fetched: fetched,
      items_inserted: inserted,
      status,
      error_message: errorMessage,
    });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runProductHunt().then(() => {
    console.log('Done');
    process.exit(0);
  });
}

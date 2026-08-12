import { runAllSources } from '../../scripts/fetch-funding-news.js';
import { runProductHunt } from '../../scripts/fetch-producthunt.js';
import { runHackerNews } from '../../scripts/fetch-hackernews.js';
import { runEnrichment } from '../../scripts/enrich-funding-data.js';
import { runGenerateIdeas } from '../../scripts/generate-ideas.js';

// Vercel Cron hits this endpoint on the schedule set in vercel.json.
// Protect it with a secret so randoms can't trigger your scrape job.

export default async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    await runAllSources();
    await runProductHunt();
    await runHackerNews();
    await runEnrichment();
    await runGenerateIdeas();
    res.status(200).json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Add or remove feeds here. Each source is tagged with a region so the
// dashboard can filter Saudi -> MENA -> USA -> Europe like you want.

export const sources = [
  // Saudi / MENA
  { name: 'Wamda', url: 'https://www.wamda.com/feed', region: 'mena' },
  { name: 'Google Alerts - Saudi Funding', url: 'REPLACE_WITH_YOUR_GOOGLE_ALERTS_RSS_URL', region: 'saudi' },
  { name: 'Google Alerts - MENA Startup Funding', url: 'REPLACE_WITH_YOUR_GOOGLE_ALERTS_RSS_URL', region: 'mena' },

  // USA
  { name: 'TechCrunch', url: 'https://techcrunch.com/category/venture/feed/', region: 'usa' },
  { name: 'Axios Pro Rata', url: 'REPLACE_IF_AVAILABLE', region: 'usa' },

  // Europe
  { name: 'EU-Startups', url: 'https://www.eu-startups.com/feed/', region: 'europe' },
  { name: 'Sifted', url: 'https://sifted.eu/feed', region: 'europe' },
];

// Keywords used to filter feed items down to actual funding news,
// since these feeds cover general startup news too, not just rounds.
export const fundingKeywords = [
  'raises', 'raised', 'funding round', 'seed round', 'series a', 'series b',
  'series c', 'closes round', 'secures funding', 'investment', 'valuation',
  'million', 'billion', 'led by', 'venture capital'
];

# Investment Tracker

Fastest path: RSS in, Supabase stores it, Vercel runs it daily, simple page to view it.

## Setup (day 1, about 1-2 hours)

1. Create a new Supabase project. Run `supabase/schema.sql` in the SQL editor.
2. Push this repo to a new GitHub repo.
3. Import the repo into Vercel.
4. Set environment variables in Vercel:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (used by the cron job, keep secret)
   - `NEXT_PUBLIC_SUPABASE_URL` (same project, public-safe)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public-safe, used by the dashboard)
   - `CRON_SECRET` (any random string you generate)
5. In Supabase, add a Row Level Security policy on `companies` and `funding_rounds`
   allowing SELECT for the anon role, so the dashboard can read data without
   exposing write access.
6. Deploy. Vercel will pick up `vercel.json` and run the cron daily at 6am UTC.

## Before it's useful

Go into `scripts/sources.js` and replace the `REPLACE_WITH_YOUR_GOOGLE_ALERTS_RSS_URL`
placeholders. To get a Google Alerts RSS feed:
1. Go to google.com/alerts
2. Create an alert for "Saudi Arabia startup funding" (repeat for MENA, etc)
3. Set "Deliver to" to RSS feed
4. Copy that URL into sources.js

This is the single biggest thing that determines how good your Saudi/MENA
coverage is, since public RSS feeds for that region are thin. Google Alerts
fills the gap for free.

## Testing locally

```
npm install
npm run scrape
```

This runs the scraper once against your Supabase project so you can see rows
show up without waiting for the cron.

## Known limitations, on purpose

- Company name and amount extraction from headlines is regex based, not perfect.
  It gets you 70-80% clean data fast. Review flagged rows in Supabase directly
  rather than trying to make extraction perfect on day one.
- No MAGNiTT or Crunchbase API integration yet, those need paid keys. Add them
  as new functions in `fetch-funding-news.js` once you decide they're worth it,
  the schema already supports it.
- Vercel Cron on the free/hobby plan may limit run frequency, check current
  Vercel pricing if daily isn't available on your plan.

## Next steps once this is running

- Add MAGNiTT API once you have a key, it is the strongest Saudi/MENA source
- Add Crunchbase API for cleaner USA data instead of TechCrunch RSS parsing
- Add a weekly digest email (Supabase + Resend, both have free tiers) so you
  get a Monday morning summary instead of having to open the dashboard

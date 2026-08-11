import { createClient } from '@supabase/supabase-js';

// Add these to your Vercel project environment variables:
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (use service role for the cron job, not anon key)

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

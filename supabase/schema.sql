-- Run this in Supabase SQL editor to set up the funding tracker

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sector text,
  region text check (region in ('saudi', 'mena', 'usa', 'europe', 'other')),
  website text,
  created_at timestamptz default now(),
  unique(name)
);

create table if not exists funding_rounds (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  round_type text, -- seed, series a, series b, etc
  amount_usd numeric,
  investors text[], -- array of investor names
  announced_date date,
  source_url text,
  source_name text, -- techcrunch, wamda, magnitt, etc
  raw_headline text,
  region text check (region in ('saudi', 'mena', 'usa', 'europe', 'other')),
  created_at timestamptz default now()
);

create table if not exists ingestion_log (
  id uuid primary key default gen_random_uuid(),
  source_name text,
  items_fetched int,
  items_inserted int,
  run_at timestamptz default now(),
  status text,
  error_message text
);

create index if not exists idx_funding_region on funding_rounds(region);
create index if not exists idx_funding_date on funding_rounds(announced_date desc);
create index if not exists idx_company_name on companies(name);

-- Commerce Hub · Off trade: the store universe and the projects done (or planned) in each store.
-- Stores come from an Excel upload for now, Salesforce later (salesforce_id). Server-side only:
-- RLS on with no policies; the app reads and writes with the service role after role checks.

create table if not exists public.off_trade_stores (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,               -- store / account number (matches Salesforce later)
  name text not null,
  chain text,                              -- retailer, e.g. African + Eastern, Spinneys, MMI
  market text,                             -- DXB, AUH, NE, OM, BH, QA, DF …
  area text,                               -- DXB Retail, DXB IR, Al Ain, AUH, NER, RAK …
  tmam text,                               -- Trade Marketing Activation Manager
  segment text,                            -- Premium, Mainstream, Value, Industrial Retail
  influenced boolean not null default false,
  visit_frequency text,                    -- weekly, bi-weekly, monthly …
  active boolean not null default true,
  salesforce_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists off_trade_stores_area_idx on public.off_trade_stores (area);
alter table public.off_trade_stores enable row level security;

create table if not exists public.off_trade_projects (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.off_trade_stores (id) on delete cascade,
  type text not null,                      -- Branding, Perfect shelf, Cold room, Fridge, FSU, Other
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'completed', 'cancelled')),
  plan_year int,                           -- the target year, e.g. 2027
  planned_date date,                       -- when we plan to execute
  completed_date date,
  expected_cost_aed numeric(12, 2) check (expected_cost_aed is null or expected_cost_aed >= 0),
  actual_cost_aed numeric(12, 2) check (actual_cost_aed is null or actual_cost_aed >= 0),
  notes text,
  import_key text unique,                  -- set for rows from the Excel upload, so re-uploading updates instead of duplicating
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists off_trade_projects_store_idx on public.off_trade_projects (store_id);
alter table public.off_trade_projects enable row level security;

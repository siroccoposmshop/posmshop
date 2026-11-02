-- POSM SHOP — accounts synced from Salesforce (org: mmielr).

-- Which Salesforce "Company Code" values belong to each market (e.g. Dubai = M10).
-- Accounts with a code not listed here are skipped by the sync.
alter table public.markets
  add column if not exists salesforce_company_codes text[] not null default '{}';
update public.markets set salesforce_company_codes = '{M10}'
where code = 'DXB' and salesforce_company_codes = '{}';

-- The Salesforce record each outlet came from.
alter table public.accounts add column if not exists salesforce_id text;
create unique index if not exists accounts_salesforce_id_idx on public.accounts (salesforce_id) where salesforce_id is not null;

-- One row per sync run (manual or scheduled), shown on Admin → Accounts.
create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'salesforce',
  triggered_by uuid references public.profiles (id),
  ok boolean not null default false,
  summary jsonb not null default '{}',
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists sync_runs_started_idx on public.sync_runs (started_at desc);
alter table public.sync_runs enable row level security;
drop policy if exists "admins read sync runs" on public.sync_runs;
create policy "admins read sync runs" on public.sync_runs for select to authenticated using (public.is_admin());

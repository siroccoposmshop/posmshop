-- Commerce Hub — Projects (phase 1).
-- All project data is read and written by the server (service role) after checking the
-- signed-in user's hub role, so these tables have RLS on with no client policies.

-- ---------------------------------------------------------------------------
-- People: hub role (separate from the POSM Shop role), reporting line, visits
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists hub_role text not null default 'kam'
    check (hub_role in ('kam', 'sm', 'cm', 'tm', 'tmm')),
  add column if not exists manager_id uuid references public.profiles (id) on delete set null,
  add column if not exists last_seen_at timestamptz;

-- Existing POSM Shop admins are Trade Marketing.
update public.profiles set hub_role = 'tmm' where role = 'admin' and hub_role = 'kam';

create table if not exists public.user_visits (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  first_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.user_visits enable row level security;

-- ---------------------------------------------------------------------------
-- Stage types (default working days per stage)
-- ---------------------------------------------------------------------------
create table if not exists public.project_stage_types (
  key text primary key,
  name text not null,
  default_days int not null check (default_days > 0),
  sort int not null
);
alter table public.project_stage_types enable row level security;
insert into public.project_stage_types (key, name, default_days, sort) values
  ('agency_creatives', 'Agency creatives', 10, 1),
  ('tm_creative', 'TM creative', 5, 2),
  ('internal_approval', 'Sirocco internal approval', 3, 3),
  ('renders', 'Renders', 5, 4),
  ('customer_approval', 'Customer approval', 5, 5),
  ('debrief', 'De-brief', 2, 6),
  ('sourcing', 'Sourcing', 10, 7),
  ('production', 'Production', 15, 8),
  ('delivery', 'Delivery', 5, 9),
  ('installation', 'Installation', 3, 10)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------
create sequence if not exists public.project_ref_seq start 1;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('PRJ-' || lpad(nextval('public.project_ref_seq')::text, 4, '0')),
  name text,
  status text not null default 'awaiting_tm'
    check (status in ('awaiting_sm', 'awaiting_cm', 'awaiting_tm', 'rejected', 'live', 'paused', 'completed', 'cancelled')),

  kam_id uuid not null references public.profiles (id),
  sm_id uuid references public.profiles (id),
  tm_id uuid references public.profiles (id),

  -- Outlet (snapshot, as on POSM orders)
  account_id uuid references public.accounts (id) on delete set null,
  account_number text not null,
  account_name text not null,
  parent_number text,
  parent_name text,
  market text,

  -- Brief
  project_type text not null,
  brands text[] not null default '{}',
  outlet_type text not null,
  contact_name text not null,
  contact_mobile text not null,
  contact_email text not null,
  budget_aed numeric(12, 2) not null check (budget_aed > 0),
  brief text not null,
  volume_budget_hl numeric(12, 1),
  incremental_volume_hl numeric(12, 1),
  desired_date date not null,

  -- PICOS: {"items": {"<key>": {"current": bool, "promised": bool, "delivered_at": ts|null}},
  --         "notes": {"availability": "", "visibility": "", "affordability": ""}}
  picos jsonb not null default '{}',
  picos_score_current int,
  picos_score_promised int,

  target_date date,               -- estimated execution date when the project was run
  rejection_reason text,
  hidden_for_kam boolean not null default false,

  submitted_at timestamptz not null default now(),
  sm_approved_at timestamptz,
  sm_approved_by uuid references public.profiles (id),
  cm_approved_at timestamptz,
  cm_approved_by uuid references public.profiles (id),
  started_at timestamptz,
  paused_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists projects_status_idx on public.projects (status);
create index if not exists projects_kam_idx on public.projects (kam_id);
create index if not exists projects_sm_idx on public.projects (sm_id);
create index if not exists projects_tm_idx on public.projects (tm_id);
alter table public.projects enable row level security;

create table if not exists public.project_stages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  key text not null,
  name text not null,
  sort int not null,
  days int not null check (days > 0),
  status text not null default 'pending' check (status in ('pending', 'active', 'done')),
  due_date date,
  started_at timestamptz,
  completed_at timestamptz,
  unique (project_id, key)
);
create index if not exists project_stages_project_idx on public.project_stages (project_id, sort);
alter table public.project_stages enable row level security;

-- Every change, time-stamped.
create table if not exists public.project_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  actor_id uuid references public.profiles (id),
  kind text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists project_events_project_idx on public.project_events (project_id, created_at desc);
alter table public.project_events enable row level security;

-- Pop-ups shown on the next visit to Projects.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;
alter table public.notifications enable row level security;

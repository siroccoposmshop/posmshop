-- Off-trade projects in the Projects area: the same tracker, a project for an off-trade store.
-- Trade Marketing raise them (no approvals) and they start straight away with their stages.

alter table public.projects add column if not exists trade text not null default 'on';
alter table public.projects drop constraint if exists projects_trade_check;
alter table public.projects add constraint projects_trade_check check (trade in ('on', 'off'));
alter table public.projects add column if not exists off_trade_store_id uuid references public.off_trade_stores (id) on delete set null;
alter table public.projects add column if not exists notes text;
create index if not exists projects_off_trade_store_idx on public.projects (off_trade_store_id);

-- Stage types belong to on-trade or off-trade projects.
alter table public.project_stage_types add column if not exists trade text not null default 'on';
alter table public.project_stage_types drop constraint if exists project_stage_types_trade_check;
alter table public.project_stage_types add constraint project_stage_types_trade_check check (trade in ('on', 'off'));
insert into public.project_stage_types (key, name, default_days, sort, trade) values
  ('ot_store_visit', 'Store visits', 2, 101, 'off'),
  ('ot_measurements', 'Measurements', 1, 102, 'off'),
  ('ot_procurement', 'Procurement', 7, 103, 'off'),
  ('ot_design', 'Design', 5, 104, 'off'),
  ('ot_sirocco_signoff', 'Sirocco sign-off', 2, 105, 'off'),
  ('ot_customer_signoff', 'Customer sign-off', 3, 106, 'off'),
  ('ot_production', 'Production', 10, 107, 'off'),
  ('ot_installation', 'Installation', 3, 108, 'off')
on conflict (key) do nothing;

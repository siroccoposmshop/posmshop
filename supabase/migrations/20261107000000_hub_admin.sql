-- Commerce Hub admin.
--  * TM and TMM are admins across everything (POSM Shop included).
--  * Projects settings (approval thresholds, GP per HL) editable from Admin → Projects.
--  * Stage types can be hidden from new projects.

-- TM / TMM always have admin access. Keep profiles.role in step with hub_role.
create or replace function public.sync_hub_admin()
returns trigger
language plpgsql
as $$
begin
  if new.hub_role in ('tm', 'tmm') then
    new.role := 'admin';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_sync_hub_admin on public.profiles;
create trigger profiles_sync_hub_admin
  before insert or update of hub_role, role on public.profiles
  for each row execute function public.sync_hub_admin();

update public.profiles set role = 'admin' where hub_role in ('tm', 'tmm') and role <> 'admin';

-- is_admin() (used by the row-level security policies) also counts TM / TMM.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active and (role = 'admin' or hub_role in ('tm', 'tmm'))
  );
$$;

-- One row of Projects settings.
create table if not exists public.hub_settings (
  id int primary key default 1 check (id = 1),
  sm_approval_aed numeric(12, 2) not null default 15000 check (sm_approval_aed > 0),
  cm_approval_aed numeric(12, 2) not null default 50000 check (cm_approval_aed > 0),
  gp_per_hl_usd numeric(12, 2) not null default 200 check (gp_per_hl_usd > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
alter table public.hub_settings enable row level security;
insert into public.hub_settings (id) values (1) on conflict (id) do nothing;

-- Stage types: hide one from new projects without touching projects that already use it.
alter table public.project_stage_types add column if not exists active boolean not null default true;

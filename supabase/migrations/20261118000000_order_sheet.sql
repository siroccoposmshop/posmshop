-- POSM Shop: the order file sent to Customer Service, built from an Excel template. The rules
-- (which cells and columns hold what) and the template itself are editable in Admin → POSM Shop →
-- Order sheet. Blank template = the one built into the site.
create table if not exists public.order_sheet_settings (
  id int primary key default 1 check (id = 1),
  rules jsonb not null default '{}'::jsonb,
  template_b64 text,
  template_name text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
alter table public.order_sheet_settings enable row level security;
insert into public.order_sheet_settings (id) values (1) on conflict (id) do nothing;

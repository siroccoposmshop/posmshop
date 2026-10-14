-- POSM SHOP — initial schema
-- Run against a NEW Supabase project owned by the Sirocco account (not PintFinder).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Markets & settings
-- ---------------------------------------------------------------------------
create table public.markets (
  code text primary key,                 -- UAE, OMN, QAT, BHR
  name text not null,
  cs_email text,                          -- Customer Service mailbox that executes orders for this market
  delivery_days int not null default 7,   -- "Delivery is expected in the next XX days"
  currency text not null default 'AED',
  sort int not null default 0
);

insert into public.markets (code, name, cs_email, delivery_days, currency, sort) values
  ('UAE', 'UAE',     null, 7, 'AED', 1),
  ('OMN', 'Oman',    null, 10, 'AED', 2),
  ('QAT', 'Qatar',   null, 10, 'AED', 3),
  ('BHR', 'Bahrain', null, 10, 'AED', 4);

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user). Role: kam | admin (Trade Marketing)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  role text not null default 'kam' check (role in ('kam', 'admin')),
  market text references public.markets (code),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Emails listed here become admins the first time they sign in.
create table public.admin_bootstrap (
  email text primary key
);

-- Only @sirocco.ae addresses may ever create an account.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(split_part(new.email, '@', 2)) <> 'sirocco.ae' then
    raise exception 'Only @sirocco.ae email addresses can access POSM SHOP';
  end if;

  insert into public.profiles (id, email, role)
  values (
    new.id,
    lower(new.email),
    case when exists (select 1 from public.admin_bootstrap b where b.email = lower(new.email))
         then 'admin' else 'kam' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active);
$$;

create or replace function public.my_market()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select market from public.profiles where id = auth.uid() and active;
$$;

-- ---------------------------------------------------------------------------
-- Accounts (customers) & contacts
-- ---------------------------------------------------------------------------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  account_number text not null unique,
  name text not null,
  market text not null references public.markets (code),
  channel text,
  active boolean not null default true,
  next_order_seq int not null default 100,
  updated_at timestamptz not null default now()
);
create index accounts_market_idx on public.accounts (market);
create index accounts_name_idx on public.accounts using gin (to_tsvector('simple', name || ' ' || account_number));

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  name text not null,
  mobile text not null,
  email text not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (account_id, email)
);

-- ---------------------------------------------------------------------------
-- Items
-- ---------------------------------------------------------------------------
create table public.items (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  brand text not null,
  name text not null,
  category text,
  value numeric(12, 2) not null default 0,   -- unit value
  stock int not null default 0,
  max_per_order int,                          -- null = no limit
  order_multiple int not null default 1 check (order_multiple >= 1),
  markets text[] not null default array['UAE', 'OMN', 'QAT', 'BHR'],
  visible boolean not null default true,
  eta date,                                   -- back-in-stock ETA when out of stock
  image_path text,                            -- path in the item-images bucket
  description text,
  updated_at timestamptz not null default now()
);
create index items_brand_idx on public.items (brand);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  account_id uuid not null references public.accounts (id),
  account_number text not null,
  account_name text not null,
  market text not null references public.markets (code),
  kam_id uuid not null references public.profiles (id),
  kam_name text,
  kam_email text not null,
  contact_name text not null,
  contact_mobile text not null,
  contact_email text not null,
  notes text,
  total_value numeric(12, 2) not null default 0,
  currency text not null default 'AED',
  status text not null default 'submitted'
    check (status in ('submitted', 'processing', 'dispatched', 'delivered', 'cancelled')),
  emails_sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index orders_created_idx on public.orders (created_at desc);
create index orders_kam_idx on public.orders (kam_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  item_id uuid references public.items (id) on delete set null,
  sku text not null,
  brand text not null,
  name text not null,
  category text,
  image_path text,
  qty int not null check (qty > 0),
  unit_value numeric(12, 2) not null,
  line_value numeric(12, 2) not null
);
create index order_items_order_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- Excel import log
-- ---------------------------------------------------------------------------
create table public.imports (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  uploaded_by uuid references public.profiles (id),
  summary jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- place_order: validates limits/multiples/stock, decrements stock and
-- allocates the order number POSM-<account number>-<seq from 100> atomically.
-- p_lines: [{ "item_id": uuid, "qty": int }]
-- ---------------------------------------------------------------------------
create or replace function public.place_order(
  p_account_id uuid,
  p_contact_name text,
  p_contact_mobile text,
  p_contact_email text,
  p_notes text,
  p_lines jsonb
)
returns table (order_id uuid, order_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_account public.accounts;
  v_market public.markets;
  v_line jsonb;
  v_item public.items;
  v_qty int;
  v_order_id uuid;
  v_number text;
  v_total numeric(12, 2) := 0;
begin
  select * into v_profile from public.profiles where id = auth.uid() and active;
  if v_profile.id is null then
    raise exception 'Not signed in';
  end if;

  select * into v_account from public.accounts where id = p_account_id and active for update;
  if v_account.id is null then
    raise exception 'Account not found';
  end if;
  if v_profile.role <> 'admin' and v_account.market is distinct from v_profile.market then
    raise exception 'Account is outside your market';
  end if;

  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'Your cart is empty';
  end if;
  if coalesce(trim(p_contact_name), '') = '' or coalesce(trim(p_contact_mobile), '') = ''
     or coalesce(trim(p_contact_email), '') = '' then
    raise exception 'Contact name, mobile and email are required';
  end if;

  select * into v_market from public.markets where code = v_account.market;

  v_number := 'POSM-' || v_account.account_number || '-' || v_account.next_order_seq;
  update public.accounts set next_order_seq = next_order_seq + 1 where id = v_account.id;

  insert into public.orders (
    order_number, account_id, account_number, account_name, market, kam_id, kam_name, kam_email,
    contact_name, contact_mobile, contact_email, notes, currency
  ) values (
    v_number, v_account.id, v_account.account_number, v_account.name, v_account.market, v_profile.id,
    v_profile.full_name, v_profile.email, trim(p_contact_name), trim(p_contact_mobile),
    lower(trim(p_contact_email)), nullif(trim(p_notes), ''), v_market.currency
  ) returning id into v_order_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_qty := (v_line ->> 'qty')::int;
    select * into v_item from public.items where id = (v_line ->> 'item_id')::uuid for update;

    if v_item.id is null or not v_item.visible or not (v_account.market = any (v_item.markets)) then
      raise exception 'An item in your cart is no longer available';
    end if;
    if v_qty is null or v_qty <= 0 or v_qty % v_item.order_multiple <> 0 then
      raise exception '% must be ordered in multiples of %', v_item.name, v_item.order_multiple;
    end if;
    if v_item.max_per_order is not null and v_qty > v_item.max_per_order then
      raise exception '% is limited to % per order', v_item.name, v_item.max_per_order;
    end if;
    if v_qty > v_item.stock then
      raise exception 'Only % of % left in stock', v_item.stock, v_item.name;
    end if;

    update public.items set stock = stock - v_qty, updated_at = now() where id = v_item.id;

    insert into public.order_items (order_id, item_id, sku, brand, name, category, image_path, qty, unit_value, line_value)
    values (v_order_id, v_item.id, v_item.sku, v_item.brand, v_item.name, v_item.category, v_item.image_path,
            v_qty, v_item.value, v_item.value * v_qty);

    v_total := v_total + v_item.value * v_qty;
  end loop;

  update public.orders set total_value = v_total where id = v_order_id;

  return query select v_order_id, v_number;
end;
$$;

revoke all on function public.place_order(uuid, text, text, text, text, jsonb) from public, anon;
grant execute on function public.place_order(uuid, text, text, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- Admin writes (items, accounts, imports, users) go through server code using
-- the service role after checking the caller is an admin.
-- ---------------------------------------------------------------------------
alter table public.markets enable row level security;
alter table public.profiles enable row level security;
alter table public.admin_bootstrap enable row level security;
alter table public.accounts enable row level security;
alter table public.contacts enable row level security;
alter table public.items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.imports enable row level security;

create policy "markets readable by signed-in users" on public.markets
  for select to authenticated using (true);

create policy "read own profile or admin" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "update own name" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- Prevent users from promoting themselves / changing market.
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

create policy "accounts in my market" on public.accounts
  for select to authenticated using (active and (market = public.my_market() or public.is_admin()));

create policy "contacts for visible accounts" on public.contacts
  for select to authenticated using (
    exists (select 1 from public.accounts a where a.id = account_id and (a.market = public.my_market() or public.is_admin()))
  );
create policy "add contacts for visible accounts" on public.contacts
  for insert to authenticated with check (
    created_by = auth.uid() and
    exists (select 1 from public.accounts a where a.id = account_id and (a.market = public.my_market() or public.is_admin()))
  );
create policy "update contacts for visible accounts" on public.contacts
  for update to authenticated using (
    exists (select 1 from public.accounts a where a.id = account_id and (a.market = public.my_market() or public.is_admin()))
  );

create policy "items visible in my market" on public.items
  for select to authenticated using (
    public.is_admin() or (visible and public.my_market() = any (markets))
  );

create policy "own orders or admin" on public.orders
  for select to authenticated using (kam_id = auth.uid() or public.is_admin());

create policy "own order lines or admin" on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and (o.kam_id = auth.uid() or public.is_admin()))
  );

create policy "admins read imports" on public.imports
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage: public bucket for item images (webp, 1200px wide)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-images', 'item-images', true, 5242880, array['image/webp'])
on conflict (id) do nothing;

-- Atomic stock adjustment used when admins cancel / un-cancel an order (service role only).
create or replace function public.adjust_item_stock(p_item_id uuid, p_delta int)
returns void
language sql
security definer
set search_path = public
as $$
  update public.items set stock = greatest(0, stock + p_delta), updated_at = now() where id = p_item_id;
$$;
revoke all on function public.adjust_item_stock(uuid, int) from public, anon, authenticated;

-- Private bucket for uploaded budgeting workbooks. Admins upload from the browser
-- (avoids serverless request-size limits); the server reads them with the service role.
insert into storage.buckets (id, name, public, file_size_limit)
values ('imports', 'imports', false, 52428800)
on conflict (id) do nothing;

create policy "admins upload workbooks" on storage.objects
  for insert to authenticated with check (bucket_id = 'imports' and public.is_admin());

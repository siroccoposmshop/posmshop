-- POSM SHOP — parent accounts & outlets, USD values
--
-- The customer list is a list of OUTLETS (Account Number e.g. "53248-SF-3",
-- Account Name e.g. "MONKEY BAR") grouped under a PARENT ACCOUNT
-- ("Parent Account: Account Name"). The parent identifier is the first 5
-- digits of the account number. KAMs search the parent, then pick the outlet.
-- Order numbers use the parent identifier: POSM-<parent>-<# from 100>.

-- ---------------------------------------------------------------------------
-- Outlets (the accounts table)
-- ---------------------------------------------------------------------------
alter table public.accounts
  add column if not exists parent_number text,
  add column if not exists parent_name text,
  add column if not exists kam_name text;

update public.accounts
set parent_number = coalesce(parent_number, substring(account_number from '^[0-9]{5}'), account_number),
    parent_name = coalesce(parent_name, name)
where parent_number is null or parent_name is null;

alter table public.accounts
  alter column parent_number set not null,
  alter column parent_name set not null,
  drop column if exists next_order_seq;

create index if not exists accounts_parent_idx on public.accounts (parent_number);
create index if not exists accounts_parent_name_idx on public.accounts (lower(parent_name));

-- Parent accounts for the first search box. security_invoker = RLS on accounts
-- still applies, so KAMs only see parents in their own market.
create or replace view public.parent_accounts
with (security_invoker = true) as
select
  parent_number,
  parent_name,
  market,
  min(kam_name) as kam_name,
  count(*)::int as outlet_count
from public.accounts
where active
group by parent_number, parent_name, market;

grant select on public.parent_accounts to authenticated;

-- ---------------------------------------------------------------------------
-- Order number sequence per parent account
-- ---------------------------------------------------------------------------
create table if not exists public.parent_order_seq (
  parent_number text primary key,
  next_seq int not null
);
alter table public.parent_order_seq enable row level security;
-- No policies: only the security-definer place_order function touches it.

-- ---------------------------------------------------------------------------
-- Orders keep the parent and the outlet
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists parent_number text,
  add column if not exists parent_name text;

-- ---------------------------------------------------------------------------
-- Item values in the budgeting workbook are USD
-- ---------------------------------------------------------------------------
alter table public.markets alter column currency set default 'USD';
alter table public.orders alter column currency set default 'USD';
update public.markets set currency = 'USD';

-- ---------------------------------------------------------------------------
-- place_order — now numbers orders by parent account
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
  v_seq int;
  v_order_id uuid;
  v_number text;
  v_total numeric(12, 2) := 0;
begin
  select * into v_profile from public.profiles where id = auth.uid() and active;
  if v_profile.id is null then
    raise exception 'Not signed in';
  end if;

  select * into v_account from public.accounts where id = p_account_id and active;
  if v_account.id is null then
    raise exception 'Outlet not found';
  end if;
  if v_profile.role <> 'admin' and v_account.market is distinct from v_profile.market then
    raise exception 'Outlet is outside your market';
  end if;

  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'Your cart is empty';
  end if;
  if coalesce(trim(p_contact_name), '') = '' or coalesce(trim(p_contact_mobile), '') = ''
     or coalesce(trim(p_contact_email), '') = '' then
    raise exception 'Contact name, mobile and email are required';
  end if;

  select * into v_market from public.markets where code = v_account.market;

  -- First order for a parent gets 100, then 101, 102… (row lock makes this safe under concurrency)
  insert into public.parent_order_seq as s (parent_number, next_seq)
  values (v_account.parent_number, 101)
  on conflict (parent_number) do update set next_seq = s.next_seq + 1
  returning s.next_seq - 1 into v_seq;

  v_number := 'POSM-' || v_account.parent_number || '-' || v_seq;

  insert into public.orders (
    order_number, account_id, account_number, account_name, parent_number, parent_name, market,
    kam_id, kam_name, kam_email, contact_name, contact_mobile, contact_email, notes, currency
  ) values (
    v_number, v_account.id, v_account.account_number, v_account.name, v_account.parent_number,
    v_account.parent_name, v_account.market, v_profile.id, v_profile.full_name, v_profile.email,
    trim(p_contact_name), trim(p_contact_mobile), lower(trim(p_contact_email)),
    nullif(trim(p_notes), ''), v_market.currency
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

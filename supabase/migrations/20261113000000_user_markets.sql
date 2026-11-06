-- People can work in several markets (ticked in Admin → Users). profiles.markets holds them;
-- profiles.market stays as the first one for older code. POSM Shop's access rules and place_order
-- accept any of a person's markets.

alter table public.profiles add column if not exists markets text[] not null default '{}';
update public.profiles set markets = array[market] where market is not null and cardinality(markets) = 0;

-- A person's markets (falls back to the single market).
create or replace function public.markets_of(p public.profiles)
returns text[]
language sql
immutable
as $$
  select case when cardinality(p.markets) > 0 then p.markets when p.market is not null then array[p.market] else '{}'::text[] end;
$$;

create or replace function public.my_markets()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select public.markets_of(p) from public.profiles p where p.id = auth.uid() and p.active), '{}'::text[]);
$$;

drop policy if exists "accounts in my market" on public.accounts;
create policy "accounts in my market" on public.accounts
  for select to authenticated using (active and (market = any (public.my_markets()) or public.is_admin()));

drop policy if exists "contacts for visible accounts" on public.contacts;
create policy "contacts for visible accounts" on public.contacts
  for select to authenticated using (
    exists (select 1 from public.accounts a where a.id = account_id and (a.market = any (public.my_markets()) or public.is_admin()))
  );
drop policy if exists "add contacts for visible accounts" on public.contacts;
create policy "add contacts for visible accounts" on public.contacts
  for insert to authenticated with check (
    created_by = auth.uid() and
    exists (select 1 from public.accounts a where a.id = account_id and (a.market = any (public.my_markets()) or public.is_admin()))
  );
drop policy if exists "update contacts for visible accounts" on public.contacts;
create policy "update contacts for visible accounts" on public.contacts
  for update to authenticated using (
    exists (select 1 from public.accounts a where a.id = account_id and (a.market = any (public.my_markets()) or public.is_admin()))
  );

drop policy if exists "items visible in my market" on public.items;
create policy "items visible in my market" on public.items
  for select to authenticated using (
    public.is_admin() or (visible and public.my_markets() && markets)
  );

-- place_order: as in 20261015000000_outlets.sql, with the market check accepting any of the person's markets.
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
  if v_profile.role <> 'admin' and not (v_account.market = any (public.markets_of(v_profile))) then
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

-- ONLY for a fresh project where the init migration failed part-way.
-- Deletes everything POSM SHOP created so the migration can be run again. Destroys data.
drop trigger if exists on_auth_user_created on auth.users;
drop table if exists public.order_items, public.orders, public.items, public.contacts,
  public.accounts, public.imports, public.admin_bootstrap, public.profiles, public.markets cascade;
drop function if exists public.place_order(uuid, text, text, text, text, jsonb);
drop function if exists public.adjust_item_stock(uuid, int);
drop function if exists public.handle_new_user(), public.is_admin(), public.my_market();
drop policy if exists "admins upload workbooks" on storage.objects;

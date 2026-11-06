-- Which side of the business someone works in: on trade, off trade, or both.
alter table public.profiles add column if not exists trade text[] not null default '{on}';
alter table public.profiles drop constraint if exists profiles_trade_check;
alter table public.profiles add constraint profiles_trade_check
  check (cardinality(trade) > 0 and trade <@ array['on', 'off']::text[]);

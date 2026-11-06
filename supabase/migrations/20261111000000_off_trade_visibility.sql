-- Off trade: what's in each store (the Visibility Master File), plus city and store type.
--   visibility   { "<asset group>": { "<brand>": quantity } }, e.g. { "Fridge": { "Heineken": 3 } }
--   match_key    channel|customer|store|type, so the list can be re-uploaded (and store codes added
--                later) without duplicating stores.
alter table public.off_trade_stores add column if not exists city text;
alter table public.off_trade_stores add column if not exists store_type text;
alter table public.off_trade_stores add column if not exists visibility jsonb not null default '{}';
alter table public.off_trade_stores add column if not exists visibility_flag text;
alter table public.off_trade_stores add column if not exists match_key text;
create unique index if not exists off_trade_stores_match_key_idx on public.off_trade_stores (match_key);

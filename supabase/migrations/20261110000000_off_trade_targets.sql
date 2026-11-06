-- Off trade: a store can be a target for a year before the project is known.
alter table public.off_trade_stores add column if not exists target_year int check (target_year is null or (target_year > 2000 and target_year < 2100));

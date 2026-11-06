-- Off trade: the year a store opened. History counts a store as an outlet from that year on;
-- blank = open before the history starts (counted in every year).
alter table public.off_trade_stores add column if not exists opened_year int check (opened_year is null or (opened_year between 1950 and 2100));

-- Off trade history: what was installed, how many, for which brand (e.g. Wall Branding · Heineken × 2).
alter table public.off_trade_projects add column if not exists item text;
alter table public.off_trade_projects add column if not exists brand text;
alter table public.off_trade_projects add column if not exists quantity int check (quantity is null or quantity > 0);

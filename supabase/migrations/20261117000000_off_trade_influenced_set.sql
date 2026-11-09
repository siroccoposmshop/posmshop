-- Off trade: influenced set by hand on the store page. Blank = worked out from the store list
-- (visibility of ours in the store).
alter table public.off_trade_stores add column if not exists influenced_set boolean;

-- Months of stock cover, read from column H ("Months of Stock") of the CURRENT STOCK tab
-- on each Excel upload. Used for the admin dashboard's "Running low" list.
alter table public.items add column if not exists months_of_stock numeric;

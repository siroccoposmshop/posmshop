-- 1. Order warnings: a reminder shown to the KAM when they review an order containing the item.
alter table public.items add column if not exists order_warning text;

-- 2. Items from the EXTRAS tab of the 2026 POSM Budgeting workbook. Costs (USD) are blank in the
--    sheet except HKN564 (HAL ORDERS: $62.50); set the others in Admin → Items. Existing SKUs are
--    left untouched.
insert into public.items (sku, brand, name, category, value, stock, months_of_stock, order_multiple, max_per_order)
values
  ('HKN107', 'Heineken',    'HEINEKEN OC BEANIE (GREEN)',                   'Clothing',  0,    494, 494,    1, null),
  ('HKN387', 'Heineken',    'HEINEKEN F1 CAP (GREEN / 2022 / OLD)',         'Clothing',  0,    408, 19.43,  1, null),
  ('HKN564', 'Heineken',    'HEINEKEN ''FANS HAVE MORE FRIENDS'' NEON',     'Signage',   62.5, 30,  null,   1, null),
  ('TIG11',  'Tiger',       'TIGER A-FRAME CHALKBOARD (BLUE / WOOD) 2026',  'Signage',   0,    20,  null,   1, null),
  ('DES001', 'Rodeo Drive', 'RODEO DRIVE PINT GLASS',                       'Glassware', 0,    1114, 101.27, 6, 24),
  ('DES002', 'Rodeo Drive', 'RODEO DRIVE HALF PINT GLASS',                  'Glassware', 0,    380, 126.67, 6, 24)
on conflict (sku) do nothing;

update public.items set order_warning = 'Not for consumers. OK for customer gifts.' where sku = 'HKN387';

select sku, brand, name, category, value, stock, order_multiple, max_per_order, order_warning
from public.items where sku in ('HKN107', 'HKN387', 'HKN564', 'TIG11', 'DES001', 'DES002') order by brand, sku;

-- Manual item order within a brand, set in Admin → Items → Reorder.
-- Items without a position follow the automatic order (2026 glasses, pints, half pints, coasters, rest).
alter table public.items add column if not exists sort_order int;

-- The Paulaner order that was previously fixed in code.
update public.items i set sort_order = v.pos
from (values ('PAUL18', 1), ('PAUL22', 2), ('PAUL17', 3), ('PAUL40', 4), ('PAUL16', 5), ('PAUL25', 6)) as v(sku, pos)
where i.sku = v.sku and i.sort_order is null;

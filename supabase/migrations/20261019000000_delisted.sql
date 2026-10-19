-- Items whose "Notes" column (CURRENT STOCK tab) says "Delist". Set on each Excel upload;
-- delisted items are left out of the admin dashboard's Out of stock and Running low warnings.
alter table public.items add column if not exists delisted boolean not null default false;

-- Items marked "Delist" in the current 2026 POSM Budgeting workbook, so the warnings are right
-- before the next upload.
update public.items set delisted = true
where sku in ('KRN003', 'MOR013', 'SMG02', 'SMG03', 'SMG04', 'SOL10', 'BRD03', 'BRR36', 'HKN498',
              'KRN002', 'PAUL1005', 'PAUL1006', 'PAUL50', 'PAUL77', 'PAUL40');

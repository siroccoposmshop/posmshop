-- POSM SHOP — markets are now Dubai, Abu Dhabi and Northern Emirates only.
-- Replaces UAE / Oman / Qatar / Bahrain. Existing UAE data moves to Dubai
-- (the whole customer list is Dubai). Safe to run once on the live database.

insert into public.markets (code, name, cs_email, delivery_days, currency, sort)
select v.code, v.name, u.cs_email, coalesce(u.delivery_days, 7), coalesce(u.currency, 'USD'), v.sort
from (values ('DXB', 'Dubai', 1), ('AUH', 'Abu Dhabi', 2), ('NE', 'Northern Emirates', 3)) as v(code, name, sort)
left join public.markets u on u.code = 'UAE'
on conflict (code) do update set name = excluded.name, sort = excluded.sort;

-- Move everything off the old markets.
update public.accounts set market = 'DXB' where market = 'UAE';
update public.accounts set market = 'DXB', active = false where market in ('OMN', 'QAT', 'BHR');
update public.orders set market = 'DXB' where market in ('UAE', 'OMN', 'QAT', 'BHR');
update public.profiles set market = 'DXB' where market = 'UAE';
update public.profiles set market = null where market in ('OMN', 'QAT', 'BHR');

-- Items are visible in all three markets; admins narrow this per item.
alter table public.items alter column markets set default array['DXB', 'AUH', 'NE'];
update public.items set markets = array['DXB', 'AUH', 'NE'];

delete from public.markets where code in ('UAE', 'OMN', 'QAT', 'BHR');

-- Outlet type (e.g. Bar, Nightclub), from the CUSTOMER LIST "Sirocco Outlet Type" column or Salesforce.
-- The project briefing form uses it to pre-select the PICOS outlet type.
alter table public.accounts add column if not exists outlet_type text;

-- Off trade: a cold room is a feature of the store (it has one or not). Blank = as the store list
-- says (its "Cold Room" column). Activating it is a "Cold room" project.
alter table public.off_trade_stores add column if not exists has_cold_room boolean;

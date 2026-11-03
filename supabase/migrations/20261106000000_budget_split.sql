-- Project budget split: the BIF amount (required) plus optional extra funding from Sirocco or another source.
-- budget_aed stays as the total, which drives the approval thresholds.
alter table public.projects add column if not exists budget_bif numeric(12, 2);
alter table public.projects add column if not exists budget_extra numeric(12, 2);
alter table public.projects add column if not exists budget_extra_source text;

alter table public.projects drop constraint if exists projects_budget_extra_source_check;
alter table public.projects add constraint projects_budget_extra_source_check
  check (budget_extra_source is null or budget_extra_source in ('sirocco', 'other'));

-- Existing projects: the whole budget was BIF.
update public.projects set budget_bif = budget_aed where budget_bif is null;

-- What a completed project actually cost (AED), entered by Trade Marketing when completing it.
-- Reports use it as the project's spend once set (else the approved budget).
alter table public.projects add column if not exists final_cost_aed numeric(12, 2) check (final_cost_aed is null or final_cost_aed >= 0);

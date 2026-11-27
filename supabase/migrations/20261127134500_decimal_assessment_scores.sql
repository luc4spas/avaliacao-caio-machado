alter table public.triagens
  alter column total_score type numeric using total_score::numeric,
  alter column score_0_100 type numeric using score_0_100::numeric;

alter table public.triagens
  drop constraint if exists triagens_risk_level_check;

alter table public.triagens
  add constraint triagens_risk_level_check
  check (risk_level in ('baixo', 'moderado', 'alto', 'sem_classificacao'));

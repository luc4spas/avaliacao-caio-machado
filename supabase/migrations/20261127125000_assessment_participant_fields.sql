alter table public.assessments
  add column participant_name_label text not null default 'Nome completo'
    check (length(btrim(participant_name_label)) between 1 and 120),
  add column participant_name_required boolean not null default false,
  add column participant_fields jsonb not null default '[]'::jsonb
    check (jsonb_typeof(participant_fields) = 'array');

alter table public.triagens
  add column participant_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(participant_data) = 'object');

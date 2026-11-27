create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (length(btrim(title)) between 1 and 120),
  description text not null default '',
  instructions text not null default '',
  version integer not null default 1 check (version > 0),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'inactive')),
  questions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(questions) = 'array'),
  scoring jsonb not null default '{"method":"sum"}'::jsonb
    check (jsonb_typeof(scoring) = 'object'),
  result_bands jsonb not null default '[]'::jsonb
    check (jsonb_typeof(result_bands) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.assessments enable row level security;
grant select on public.assessments to anon, authenticated;
grant insert, update, delete on public.assessments to authenticated;

create policy "published assessments read"
  on public.assessments
  for select
  to anon, authenticated
  using (status = 'published' or public.has_role(auth.uid(), 'admin'));

create policy "admin manages assessments"
  on public.assessments
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

insert into public.assessments (
  slug, title, description, instructions, version, status, questions, scoring, result_bands
)
values (
  'tdah-adulto',
  'Autoavaliação de Indicativos de TDAH em Adultos',
  'Questionário de triagem de indicativos de TDAH em adultos.',
  'Responda pensando na frequência dos comportamentos nos últimos 6 meses.',
  1,
  'published',
  $questions$
  [
    {"id":"q1","title":"Dificuldade para finalizar detalhes","text":"Com que frequência você tem dificuldade para concluir os detalhes finais de um projeto depois que as partes mais desafiadoras ou interessantes já foram feitas?","weight":1,"category":"Desatenção","options":[{"label":"Nunca","value":0},{"label":"Raramente","value":1},{"label":"Às vezes","value":2},{"label":"Frequentemente","value":3},{"label":"Muito frequentemente","value":4}]},
    {"id":"q2","title":"Organização de tarefas","text":"Com que frequência você tem dificuldade para colocar as coisas em ordem quando precisa realizar uma tarefa que exige planejamento?","weight":1,"category":"Desatenção","options":[{"label":"Nunca","value":0},{"label":"Raramente","value":1},{"label":"Às vezes","value":2},{"label":"Frequentemente","value":3},{"label":"Muito frequentemente","value":4}]},
    {"id":"q3","title":"Esquecimentos no dia a dia","text":"Com que frequência você tem problemas para se lembrar de compromissos, prazos ou obrigações?","weight":1,"category":"Desatenção","options":[{"label":"Nunca","value":0},{"label":"Raramente","value":1},{"label":"Às vezes","value":2},{"label":"Frequentemente","value":3},{"label":"Muito frequentemente","value":4}]},
    {"id":"q4","title":"Procrastinação em tarefas complexas","text":"Quando precisa fazer algo que exige muita concentração mental, com que frequência você evita ou adia o início?","weight":1,"category":"Desatenção","options":[{"label":"Nunca","value":0},{"label":"Raramente","value":1},{"label":"Às vezes","value":2},{"label":"Frequentemente","value":3},{"label":"Muito frequentemente","value":4}]},
    {"id":"q5","title":"Inquietação física","text":"Com que frequência você fica mexendo as mãos, os pés ou se contorcendo na cadeira quando precisa permanecer sentado por muito tempo?","weight":1,"category":"Hiperatividade/Impulsividade","options":[{"label":"Nunca","value":0},{"label":"Raramente","value":1},{"label":"Às vezes","value":2},{"label":"Frequentemente","value":3},{"label":"Muito frequentemente","value":4}]},
    {"id":"q6","title":"Sensação de \"motor ligado\"","text":"Com que frequência você se sente excessivamente ativo e compelido a fazer coisas, como se estivesse \"movido a motor\" ou com dificuldade para relaxar?","weight":1,"category":"Hiperatividade/Impulsividade","options":[{"label":"Nunca","value":0},{"label":"Raramente","value":1},{"label":"Às vezes","value":2},{"label":"Frequentemente","value":3},{"label":"Muito frequentemente","value":4}]},
    {"id":"q7","title":"Distração com estímulos externos","text":"Com que frequência você se distrai facilmente com barulhos, conversas ou atividades ao seu redor enquanto tenta focar no trabalho ou nos estudos?","weight":1,"category":"Desatenção","options":[{"label":"Nunca","value":0},{"label":"Raramente","value":1},{"label":"Às vezes","value":2},{"label":"Frequentemente","value":3},{"label":"Muito frequentemente","value":4}]},
    {"id":"q8","title":"Perda de objetos","text":"Com que frequência você perde ou tem dificuldade para encontrar objetos necessários no dia a dia (chaves, celular, carteira, documentos)?","weight":1,"category":"Desatenção","options":[{"label":"Nunca","value":0},{"label":"Raramente","value":1},{"label":"Às vezes","value":2},{"label":"Frequentemente","value":3},{"label":"Muito frequentemente","value":4}]},
    {"id":"q9","title":"Impulsividade na fala","text":"Com que frequência você termina as frases das pessoas antes que elas terminem de falar ou interrompe conversas sem perceber?","weight":1,"category":"Hiperatividade/Impulsividade","options":[{"label":"Nunca","value":0},{"label":"Raramente","value":1},{"label":"Às vezes","value":2},{"label":"Frequentemente","value":3},{"label":"Muito frequentemente","value":4}]},
    {"id":"q10","title":"Gestão do tempo e espera","text":"Com que frequência você tem dificuldade para esperar a sua vez em filas, reuniões ou situações que exigem paciência, ou subestima constantemente o tempo necessário para realizar tarefas?","weight":1,"category":"Hiperatividade/Impulsividade","options":[{"label":"Nunca","value":0},{"label":"Raramente","value":1},{"label":"Às vezes","value":2},{"label":"Frequentemente","value":3},{"label":"Muito frequentemente","value":4}]}
  ]
  $questions$::jsonb,
  '{"method":"weighted_sum"}'::jsonb,
  $bands$
  [
    {"min":0,"max":35,"label":"Baixos indicativos","description":"As dificuldades relatadas estão dentro da variação comum do dia a dia, podendo estar ligadas a estresse pontual, cansaço ou sobrecarga.","risk":"baixo"},
    {"min":36,"max":65,"label":"Indicativos moderados","description":"Existem sinais relevantes que podem estar impactando sua rotina. Vale a pena observar se esses comportamentos ocorrem em mais de um ambiente (trabalho, casa, relacionamentos) e se existem desde a infância ou adolescência.","risk":"moderado"},
    {"min":66,"max":100,"label":"Altos indicativos","description":"Há uma presença frequente de sintomas compatíveis com o TDAH adulto. É altamente recomendável buscar uma avaliação profissional.","risk":"alto"}
  ]
  $bands$::jsonb
)
on conflict (slug) do nothing;

alter table public.triagens
  add column assessment_id uuid references public.assessments(id) on delete restrict,
  add column assessment_title text,
  add column assessment_version integer,
  add column score_raw numeric,
  add column score_max numeric,
  add column score_0_100 integer,
  add column score_breakdown jsonb not null default '{}'::jsonb,
  add column result_band text,
  add column assessment_snapshot jsonb;

alter table public.triagens
  drop constraint if exists triagens_total_score_check,
  drop constraint if exists triagens_inattention_score_check,
  drop constraint if exists triagens_hyperactivity_score_check;

update public.triagens as t
set assessment_id = a.id,
    assessment_title = a.title,
    assessment_version = a.version,
    score_raw = t.total_score,
    score_max = 40,
    score_0_100 = round(t.total_score * 100.0 / 40),
    total_score = round(t.total_score * 100.0 / 40),
    inattention_score = round(t.inattention_score * 100.0 / 24),
    hyperactivity_score = round(t.hyperactivity_score * 100.0 / 16),
    result_band = case t.risk_level
      when 'baixo' then 'Baixos indicativos'
      when 'moderado' then 'Indicativos moderados'
      else 'Altos indicativos'
    end,
    score_breakdown = jsonb_build_object(
      'Desatenção', round(t.inattention_score * 100.0 / 24),
      'Hiperatividade/Impulsividade', round(t.hyperactivity_score * 100.0 / 16)
    ),
    assessment_snapshot = to_jsonb(a)
from public.assessments as a
where a.slug = 'tdah-adulto';

alter table public.triagens
  alter column assessment_title set not null,
  alter column assessment_version set not null,
  alter column score_raw set not null,
  alter column score_max set not null,
  alter column score_0_100 set not null,
  alter column result_band set not null,
  alter column assessment_snapshot set default '{}'::jsonb,
  alter column assessment_snapshot set not null,
  alter column inattention_score drop not null,
  alter column hyperactivity_score drop not null;

alter table public.triagens
  add constraint triagens_total_score_check check (total_score between 0 and 100),
  add constraint triagens_score_0_100_check check (score_0_100 between 0 and 100),
  add constraint triagens_inattention_score_check check (inattention_score between 0 and 100),
  add constraint triagens_hyperactivity_score_check check (hyperactivity_score between 0 and 100),
  add constraint triagens_score_range_check check (score_max > 0 and score_raw >= 0),
  add constraint triagens_score_breakdown_object check (jsonb_typeof(score_breakdown) = 'object'),
  add constraint triagens_assessment_snapshot_object check (jsonb_typeof(assessment_snapshot) = 'object');

alter table public.triagens
  alter column assessment_id set not null,
  alter column assessment_version set default 1,
  alter column assessment_title set default 'Autoavaliação de Indicativos de TDAH em Adultos',
  alter column score_0_100 set default 0,
  alter column score_raw set default 0,
  alter column score_max set default 100,
  alter column result_band set default '',
  alter column assessment_snapshot set default '{}'::jsonb;

drop policy if exists "public insert" on public.triagens;
create policy "public insert"
  on public.triagens
  for insert
  to anon, authenticated
  with check (
    crm_status = 'novo'
    and internal_notes = ''
    and lgpd_consent = true
    and exists (
      select 1
      from public.assessments as a
      where a.id = assessment_id
        and a.status = 'published'
        and a.version = assessment_version
    )
  );

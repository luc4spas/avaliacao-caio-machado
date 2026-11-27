drop policy if exists "published assessments read" on public.assessments;

create policy "published assessments read anon"
  on public.assessments
  for select
  to anon
  using (status = 'published');

create policy "published assessments read authenticated"
  on public.assessments
  for select
  to authenticated
  using (status = 'published');

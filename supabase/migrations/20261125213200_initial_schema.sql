create type public.app_role as enum ('admin');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create policy "own roles"
  on public.user_roles
  for select
  to authenticated
  using (user_id = auth.uid());

create table public.admin_email_allowlist (
  email text primary key,
  constraint admin_email_allowlist_email_lower check (email = lower(email))
);

alter table public.admin_email_allowlist enable row level security;
revoke all on public.admin_email_allowlist from public, anon, authenticated;
grant all on public.admin_email_allowlist to service_role;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

revoke all on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

create or replace function public.grant_admin_by_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.email is not null and exists (
    select 1
    from public.admin_email_allowlist
    where email = lower(new.email)
  ) then
    insert into public.user_roles(user_id, role)
    values (new.id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;

  return new;
end
$$;

revoke all on function public.grant_admin_by_email() from public, anon, authenticated;

create trigger on_auth_user_admin
  after insert on auth.users
  for each row
  execute function public.grant_admin_by_email();

create table public.triagens (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  patient_name text not null default '',
  patient_email text not null default '',
  patient_whatsapp text not null default '',
  lgpd_consent boolean not null default false,
  answers jsonb not null default '[]'::jsonb,
  total_score integer not null check (total_score between 0 and 40),
  inattention_score integer not null check (inattention_score between 0 and 24),
  hyperactivity_score integer not null check (hyperactivity_score between 0 and 16),
  risk_level text not null check (risk_level in ('baixo', 'moderado', 'alto')),
  crm_status text not null default 'novo'
    check (crm_status in ('novo', 'em_contato', 'agendado', 'avaliado', 'arquivado')),
  internal_notes text not null default ''
);

grant insert on public.triagens to anon, authenticated;
grant select, update, delete on public.triagens to authenticated;
grant all on public.triagens to service_role;
alter table public.triagens enable row level security;

create policy "public insert"
  on public.triagens
  for insert
  to anon, authenticated
  with check (
    crm_status = 'novo'
    and internal_notes = ''
    and lgpd_consent = true
  );

create policy "admin select"
  on public.triagens
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "admin update"
  on public.triagens
  for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "admin delete"
  on public.triagens
  for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

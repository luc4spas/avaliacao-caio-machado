alter table public.user_roles
  add column if not exists is_active boolean not null default true;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
      and is_active
  )
$$;

create or replace function public.set_team_user_role(_user_id uuid, _role public.app_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  was_active boolean;
  active_admin_count integer;
begin
  if _role not in ('admin', 'equipe') then
    raise exception 'Unsupported team role';
  end if;

  perform pg_advisory_xact_lock(754231, 1);

  select coalesce(bool_or(is_active), true)
  into was_active
  from public.user_roles
  where user_id = _user_id;

  if was_active
     and _role <> 'admin'
     and exists (
       select 1
       from public.user_roles
       where user_id = _user_id
         and role = 'admin'
         and is_active
     ) then
    select count(*) into active_admin_count
    from public.user_roles
    where role = 'admin' and is_active;

    if active_admin_count <= 1 then
      raise exception 'Cannot remove the last active administrator';
    end if;
  end if;

  delete from public.user_roles where user_id = _user_id;
  insert into public.user_roles(user_id, role, is_active)
  values (_user_id, _role, was_active);
end
$$;

create or replace function public.set_team_user_active(_user_id uuid, _active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_is_active_admin boolean;
  active_admin_count integer;
begin
  perform pg_advisory_xact_lock(754231, 1);

  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = 'admin'
      and is_active
  ) into target_is_active_admin;

  if target_is_active_admin and not _active then
    select count(*) into active_admin_count
    from public.user_roles
    where role = 'admin' and is_active;

    if active_admin_count <= 1 then
      raise exception 'Cannot deactivate the last active administrator';
    end if;
  end if;

  update public.user_roles
  set is_active = _active
  where user_id = _user_id;

  if not found then
    raise exception 'Team user not found';
  end if;
end
$$;

revoke all on function public.set_team_user_role(uuid, public.app_role) from public, anon, authenticated;
revoke all on function public.set_team_user_active(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_team_user_role(uuid, public.app_role) to service_role;
grant execute on function public.set_team_user_active(uuid, boolean) to service_role;

drop policy if exists "equipe select" on public.triagens;
create policy "equipe select"
  on public.triagens
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'equipe'));

drop policy if exists "equipe update" on public.triagens;
create policy "equipe update"
  on public.triagens
  for update
  to authenticated
  using (public.has_role(auth.uid(), 'equipe'))
  with check (public.has_role(auth.uid(), 'equipe'));

revoke update on public.triagens from authenticated;
grant update (crm_status, internal_notes) on public.triagens to authenticated;

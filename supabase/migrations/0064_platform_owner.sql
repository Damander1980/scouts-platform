-- Platform owner view (Floyd, 2026-10-23): see every troop and every user across the platform.
-- Names come back as first name + last initial only; email only for adults with a login, never for
-- Scouts. No birthdates, contact details, health or money. Each look is written to the audit log.
create table if not exists public.platform_owners (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_owners enable row level security;
-- No policies: only security definer functions below read it, and nobody can add themselves.

insert into public.platform_owners (user_id)
  select id from auth.users where lower(email) = 'fdkobler@gmail.com'
  on conflict do nothing;

-- Owner tools show children's names, so a two-step session is required too.
create or replace function public.is_platform_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select public.session_two_step() and exists (select 1 from public.platform_owners where user_id = auth.uid());
$$;
grant execute on function public.is_platform_owner() to authenticated;

-- Just "am I an owner", without the two-step part, so the app can send them to two-step first.
create or replace function public.am_platform_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_owners where user_id = auth.uid());
$$;
grant execute on function public.am_platform_owner() to authenticated;

create or replace function public.platform_units()
returns table (id uuid, name text, unit_number text, city text, state text, subscription_status text,
               created_at timestamptz, scouts int, adults int, logins int, admins int, pending_requests int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_owner() then raise exception 'Not allowed'; end if;
  return query
  select o.id, o.name, o.unit_number, o.city, o.state, o.subscription_status, o.created_at,
    (select count(*)::int from memberships m join persons p on p.id = m.person_id where m.org_id = o.id and m.status = 'active' and p.type = 'youth'),
    (select count(*)::int from memberships m join persons p on p.id = m.person_id where m.org_id = o.id and m.status = 'active' and p.type = 'adult'),
    (select count(*)::int from memberships m join persons p on p.id = m.person_id where m.org_id = o.id and m.status = 'active' and p.user_id is not null),
    (select count(*)::int from memberships m where m.org_id = o.id and m.status = 'active' and m.is_admin),
    (select count(*)::int from join_requests j where j.org_id = o.id and j.status = 'pending')
  from organizations o order by o.created_at;
end;
$$;
grant execute on function public.platform_units() to authenticated;

create or replace function public.platform_people(p_org uuid default null)
returns table (person_id uuid, display_name text, type text, has_login boolean, email text,
               units jsonb, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_owner() then raise exception 'Not allowed'; end if;
  insert into public.audit_log (org_id, actor_id, action, target_type, payload)
    values (p_org, public.my_person_id(), 'platform.people_viewed', 'organization', jsonb_build_object('org', p_org));
  return query
  select p.id,
    p.first_name || case when coalesce(p.last_name, '') = '' then '' else ' ' || left(p.last_name, 1) || '.' end,
    p.type, p.user_id is not null,
    case when p.type = 'adult' then u.email end,
    coalesce((select jsonb_agg(jsonb_build_object('org', o.name, 'org_id', o.id, 'role', m.role, 'status', m.status, 'admin', m.is_admin) order by o.name)
              from memberships m join organizations o on o.id = m.org_id where m.person_id = p.id), '[]'::jsonb),
    p.created_at
  from persons p left join users u on u.id = p.user_id
  where p_org is null or exists (select 1 from memberships m where m.person_id = p.id and m.org_id = p_org)
  order by p.first_name, p.last_name, p.id; -- id breaks ties so the page can fetch past 1000 rows in stable pages
end;
$$;
grant execute on function public.platform_people(uuid) to authenticated;

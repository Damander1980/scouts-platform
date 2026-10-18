-- 0009: family helpers used by onboarding.

create or replace function public.my_household_id()
returns uuid language sql stable security definer as $$
  select hm.household_id from public.household_members hm
  join public.persons p on p.id = hm.person_id
  where p.user_id = auth.uid() and hm.is_guardian
  order by (select count(*) from public.household_members x where x.household_id = hm.household_id) desc
  limit 1;
$$;

create or replace function public.my_family()
returns table (id uuid, first_name text, last_name text, type text, birthdate date)
language sql stable security definer as $$
  select p.id, p.first_name, p.last_name, p.type, p.birthdate
  from public.household_members hm join public.persons p on p.id = hm.person_id
  where hm.household_id = public.my_household_id()
  order by p.type, p.birthdate nulls last, p.first_name;
$$;

create or replace function public.my_pending_joins()
returns table (id uuid, org_name text, created_at timestamptz)
language sql stable security definer as $$
  select j.id, o.name, j.created_at from public.join_requests j
  join public.organizations o on o.id = j.org_id
  where j.requested_by = public.my_person_id() and j.status = 'pending';
$$;

-- Joining a co-parent's household folds away the solo household made at sign-up.
create or replace function public.accept_household_invite(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid; inv record; old_hid uuid;
begin
  me := public.my_person_id();
  if me is null then raise exception 'Finish your profile first'; end if;
  select * into inv from public.household_invites where code = lower(trim(p_code)) and used_by is null;
  if inv is null then raise exception 'That family code is not valid or was already used'; end if;

  select hm.household_id into old_hid from public.household_members hm
  where hm.person_id = me and hm.household_id <> inv.household_id
    and (select count(*) from public.household_members x where x.household_id = hm.household_id) = 1
  limit 1;

  insert into public.household_members (household_id, person_id, relation, is_guardian)
  values (inv.household_id, me, 'guardian', true) on conflict do nothing;
  update public.household_invites set used_by = me where code = inv.code;
  if old_hid is not null then delete from public.households where id = old_hid; end if;
  return inv.household_id;
end;
$$;

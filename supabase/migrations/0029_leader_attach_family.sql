-- 0029: unit leaders can attach a Scout to a family (or a second family) and detach again.

create or replace function public.attach_child_to_family(p_org uuid, p_child uuid, p_household uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_org_leader(p_org) then raise exception 'Only unit leaders can attach a Scout to a family'; end if;
  if not exists (select 1 from public.memberships where org_id = p_org and person_id = p_child) then raise exception 'That person is not in this unit'; end if;
  if not exists (select 1 from public.household_members hm join public.memberships m on m.person_id = hm.person_id and m.org_id = p_org where hm.household_id = p_household) then
    raise exception 'That family is not part of this unit';
  end if;
  insert into public.household_members (household_id, person_id, relation, is_guardian)
  values (p_household, p_child, 'scout', false) on conflict do nothing;
  insert into public.audit_log (org_id, actor_id, action, target_type, target_id, payload)
  values (p_org, public.my_person_id(), 'family.attached', 'person', p_child, jsonb_build_object('household', p_household));
end;
$$;

create or replace function public.detach_child_from_family(p_org uuid, p_child uuid, p_household uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_org_leader(p_org) then raise exception 'Only unit leaders can change families'; end if;
  if (select count(*) from public.household_members where person_id = p_child) < 2 then
    raise exception 'Attach the Scout to another family first. Every Scout needs at least one family.';
  end if;
  delete from public.household_members where household_id = p_household and person_id = p_child;
  insert into public.audit_log (org_id, actor_id, action, target_type, target_id, payload)
  values (p_org, public.my_person_id(), 'family.detached', 'person', p_child, jsonb_build_object('household', p_household));
end;
$$;

create or replace function public.person_households(p_org uuid)
returns table (person_id uuid, household_id uuid, household_name text)
language sql stable security definer as $$
  select hm.person_id, h.id, h.name
  from public.household_members hm join public.households h on h.id = hm.household_id
  where public.is_org_leader(p_org)
    and exists (select 1 from public.memberships m where m.person_id = hm.person_id and m.org_id = p_org);
$$;

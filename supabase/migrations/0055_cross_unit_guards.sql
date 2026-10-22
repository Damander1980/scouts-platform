-- Cross-unit guards. Anyone can start a troop and become its admin in seconds, so "admin of p_org"
-- protects nothing unless the person or family acted on is actually in p_org. Before this:
-- * create_claim_code / admin_add_person let an admin plant themselves as guardian of any family.
-- * admins could insert a membership row for anyone on the platform (then see private kid data).
-- * detach_child_from_family and set_contact_email worked on people in other units.

create or replace function public.person_in_org(p_person uuid, p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships where person_id = p_person and org_id = p_org and status in ('active', 'inactive'));
$$;

create or replace function public.household_in_org(p_household uuid, p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.household_members hm join public.memberships m on m.person_id = hm.person_id and m.org_id = p_org
                 where hm.household_id = p_household);
$$;

-- Memberships are created only through definer functions (join approval, add person, import, setup),
-- which check who may join. Admins keep editing and removing rows in their own unit.
drop policy if exists "memberships: admins manage" on public.memberships;
create policy "memberships: admins update" on public.memberships for update
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));
create policy "memberships: admins delete" on public.memberships for delete
  using (public.is_org_admin(org_id));

create or replace function public.create_claim_code(p_org uuid, p_person uuid)
returns text language plpgsql security definer set search_path = public as $$
declare c text; hid uuid;
begin
  if not public.is_org_admin(p_org) then raise exception 'Not allowed'; end if;
  if not public.person_in_org(p_person, p_org) then raise exception 'That person is not in this unit'; end if;
  hid := public.person_household_in(p_person, p_org);
  if hid is null then raise exception 'That person has no family in this unit yet'; end if;
  insert into public.claim_codes (org_id, household_id, person_id) values (p_org, hid, p_person) returning code into c;
  return c;
end;
$$;

create or replace function public.admin_add_person(p_org uuid, p_first text, p_last text, p_type text, p_birthdate date, p_role text, p_household uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid; hid uuid;
begin
  if not public.is_org_admin(p_org) then raise exception 'Only unit admins can add members'; end if;
  if p_household is not null and not public.household_in_org(p_household, p_org) then
    raise exception 'That family is not part of this unit';
  end if;
  insert into public.persons (first_name, last_name, type, birthdate) values (trim(p_first), trim(p_last), p_type, p_birthdate) returning id into pid;
  hid := p_household;
  if hid is null then
    insert into public.households (name, org_id) values (trim(p_last) || ' family', p_org) returning id into hid;
  end if;
  insert into public.household_members (household_id, person_id, relation, is_guardian)
  values (hid, pid, case when p_type = 'youth' then 'scout' else 'parent' end, p_type = 'adult');
  insert into public.memberships (org_id, person_id, role, status) values (p_org, pid, p_role, 'active');
  return pid;
end;
$$;

create or replace function public.detach_child_from_family(p_org uuid, p_child uuid, p_household uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_org_leader(p_org) then raise exception 'Only unit leaders can change families'; end if;
  if not public.person_in_org(p_child, p_org) then raise exception 'That person is not in this unit'; end if;
  if not public.household_in_org(p_household, p_org) then raise exception 'That family is not part of this unit'; end if;
  if (select count(*) from public.household_members where person_id = p_child) < 2 then
    raise exception 'Attach the Scout to another family first. Every Scout needs at least one family.';
  end if;
  delete from public.household_members where household_id = p_household and person_id = p_child;
  insert into public.audit_log (org_id, actor_id, action, target_type, target_id, payload)
  values (p_org, public.my_person_id(), 'family.detached', 'person', p_child, jsonb_build_object('household', p_household));
end;
$$;

create or replace function public.set_contact_email(p_org uuid, p_person uuid, p_email text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not ((public.is_org_admin(p_org) and public.person_in_org(p_person, p_org)) or public.can_act_for(p_person)) then
    raise exception 'Not allowed';
  end if;
  update public.persons set email = nullif(lower(trim(p_email)), '') where id = p_person;
end;
$$;

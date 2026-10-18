-- 0014: spec permissions — only unit admins approve joins and change roles.

create or replace function public.decide_join(p_request uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare r record; pid uuid; ptype text;
begin
  select * into r from public.join_requests where id = p_request;
  if r is null or not public.is_org_admin(r.org_id) then raise exception 'Only unit admins can approve families'; end if;
  if r.status <> 'pending' then raise exception 'Already decided'; end if;
  if p_approve then
    foreach pid in array r.person_ids loop
      select type into ptype from public.persons where id = pid;
      insert into public.memberships (org_id, person_id, role, status)
      values (r.org_id, pid, case when ptype = 'youth' then 'scout' else 'parent_guardian' end, 'active')
      on conflict (org_id, person_id) do update set status = 'active';
    end loop;
  end if;
  update public.join_requests set status = case when p_approve then 'approved' else 'declined' end,
    decided_by = public.my_person_id(), decided_at = now() where id = p_request;
end;
$$;

create or replace function public.join_request_people(p_org uuid)
returns table (request_id uuid, person_id uuid, first_name text, last_name text, type text, birthdate date, is_requester boolean)
language sql stable security definer as $$
  select j.id, p.id, p.first_name, p.last_name, p.type, p.birthdate, p.id = j.requested_by
  from public.join_requests j
  join public.persons p on p.id = j.requested_by or p.id = any(j.person_ids)
  where j.org_id = p_org and j.status = 'pending' and public.is_org_leader(p_org);
$$;

drop policy if exists "memberships: leaders manage" on public.memberships;
create policy "memberships: admins manage" on public.memberships for all
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- Admins can add people directly (e.g. from a roster import) without a family account.
create or replace function public.admin_add_person(p_org uuid, p_first text, p_last text, p_type text, p_birthdate date, p_role text, p_household uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid; hid uuid;
begin
  if not public.is_org_admin(p_org) then raise exception 'Only unit admins can add members'; end if;
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

-- A family created by an admin can later be claimed by the real parent with a claim code.
create table if not exists public.claim_codes (
  code         text primary key default substr(md5(random()::text), 1, 10),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  person_id    uuid references public.persons(id) on delete cascade,
  used_by      uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
alter table public.claim_codes enable row level security;
create policy "claim: admins view" on public.claim_codes for select using (public.is_org_admin(org_id));

create or replace function public.create_claim_code(p_org uuid, p_person uuid)
returns text language plpgsql security definer as $$
declare c text; hid uuid;
begin
  if not public.is_org_admin(p_org) then raise exception 'Not allowed'; end if;
  hid := public.person_household(p_person);
  insert into public.claim_codes (org_id, household_id, person_id) values (p_org, hid, p_person) returning code into c;
  return c;
end;
$$;

-- A signed-in parent claims an adult record (theirs) created by an admin import.
create or replace function public.claim_record(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare cc record; me uuid; target uuid;
begin
  select * into cc from public.claim_codes where code = lower(trim(p_code)) and used_by is null;
  if cc is null then raise exception 'That code is not valid or was already used'; end if;
  me := public.my_person_id();
  target := cc.person_id;
  if target is not null and (select user_id from public.persons where id = target) is null
     and (select type from public.persons where id = target) = 'adult' and me is null then
    update public.persons set user_id = auth.uid() where id = target;
  else
    if me is null then
      insert into public.persons (user_id, first_name, last_name, type) values (auth.uid(), 'New', '', 'adult') returning id into me;
    end if;
    insert into public.household_members (household_id, person_id, relation, is_guardian)
    values (cc.household_id, me, 'parent', true) on conflict do nothing;
  end if;
  update public.claim_codes set used_by = auth.uid() where code = cc.code;
  return cc.household_id;
end;
$$;

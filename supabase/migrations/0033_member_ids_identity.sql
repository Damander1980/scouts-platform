-- 0033: Scouting America member IDs, nicknames, protected official names, parents can mark requirements complete.

alter table public.persons add column if not exists member_id text;
alter table public.persons add column if not exists nickname text;
create index if not exists idx_persons_member_id on public.persons (member_id) where member_id is not null;

-- Official name and Member ID must match the Scouting America application. Once a person belongs to a
-- unit, only that unit's leaders can change them; parents can still set a nickname and contact details.
create or replace function public.guard_official_identity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.first_name is distinct from old.first_name or new.last_name is distinct from old.last_name or new.member_id is distinct from old.member_id)
     and exists (select 1 from public.memberships m where m.person_id = new.id)
     and not exists (select 1 from public.memberships m where m.person_id = new.id and public.is_org_leader(m.org_id)) then
    raise exception 'Name and Member ID must match the Scouting America registration. Ask a unit leader to change them.';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_identity on public.persons;
create trigger trg_guard_identity before update on public.persons for each row execute function public.guard_official_identity();

-- Scoutbook model: a Scout or parent marks a requirement complete; a leader or counselor approves it.
drop policy if exists "req_progress: own, leader, or counselor insert" on public.requirement_progress;
drop policy if exists "req_progress: own, leader, or counselor update" on public.requirement_progress;
create policy "req_progress: family, leader, or counselor insert" on public.requirement_progress
  for insert with check (public.is_org_member(org_id) and (public.can_act_for(person_id) or public.can_sign_requirement(org_id, requirement_id)));
create policy "req_progress: family, leader, or counselor update" on public.requirement_progress
  for update using (public.can_act_for(person_id) or public.can_sign_requirement(org_id, requirement_id));


create or replace function public.import_roster(p_org uuid, p_file text, p_rows jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  r jsonb; bid uuid; hid uuid; pid uuid; patid uuid; key text;
  homes jsonb := '{}'; persons_made uuid[] := '{}'; homes_made uuid[] := '{}'; patrols_made uuid[] := '{}'; n int := 0;
  ptype text; prole text;
begin
  if not public.is_org_admin(p_org) then raise exception 'Only unit admins can import'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    if coalesce(trim(r->>'first'), '') = '' or coalesce(trim(r->>'last'), '') = '' then continue; end if;
    ptype := case when lower(coalesce(r->>'type', 'youth')) in ('adult','parent','leader','a') then 'adult' else 'youth' end;
    prole := coalesce(nullif(r->>'role', ''), case when ptype = 'youth' then 'scout' else 'parent_guardian' end);
    if prole not in ('scoutmaster','assistant_scoutmaster','committee_chair','committee_member','treasurer','advancement_chair',
                     'chartered_org_rep','parent_guardian','scout','den_leader','cubmaster','crew_advisor','skipper','merit_badge_counselor') then
      prole := case when ptype = 'youth' then 'scout' else 'parent_guardian' end;
    end if;

    -- Skip people already on the roster with the same name and birthday.
    select p.id into pid from public.persons p join public.memberships m on m.person_id = p.id and m.org_id = p_org
      where lower(p.first_name) = lower(trim(r->>'first')) and lower(p.last_name) = lower(trim(r->>'last'))
        and (p.birthdate is not distinct from nullif(r->>'birthdate', '')::date) limit 1;
    if pid is null and nullif(trim(r->>'member_id'), '') is not null then
      select p.id into pid from public.persons p join public.memberships m on m.person_id = p.id and m.org_id = p_org where p.member_id = trim(r->>'member_id') limit 1;
    end if;
    if pid is not null then continue; end if;

    key := lower(coalesce(nullif(trim(r->>'household'), ''), trim(r->>'last')));
    hid := (homes->>key)::uuid;
    if hid is null then
      insert into public.households (name, org_id) values (initcap(trim(r->>'last')) || ' family', p_org) returning id into hid;
      homes := homes || jsonb_build_object(key, hid);
      homes_made := homes_made || hid;
    end if;

    insert into public.persons (first_name, last_name, type, birthdate, email, member_id)
    values (trim(r->>'first'), trim(r->>'last'), ptype, nullif(r->>'birthdate', '')::date,
            case when ptype = 'adult' then nullif(lower(trim(r->>'email')), '') end, nullif(trim(r->>'member_id'), '')) returning id into pid;
    persons_made := persons_made || pid;
    insert into public.household_members (household_id, person_id, relation, is_guardian)
    values (hid, pid, case when ptype = 'youth' then 'scout' else 'parent' end, ptype = 'adult');
    insert into public.memberships (org_id, person_id, role, status) values (p_org, pid, prole, 'active');

    if coalesce(trim(r->>'patrol'), '') <> '' then
      select id into patid from public.patrols where org_id = p_org and lower(name) = lower(trim(r->>'patrol')) and active limit 1;
      if patid is null then
        insert into public.patrols (org_id, name) values (p_org, trim(r->>'patrol')) returning id into patid;
        patrols_made := patrols_made || patid;
      end if;
      insert into public.patrol_members (org_id, patrol_id, person_id) values (p_org, patid, pid);
    end if;
    n := n + 1;
  end loop;

  insert into public.import_batches (org_id, kind, file_name, row_count, created_by, created_ids)
  values (p_org, 'roster', p_file, n, public.my_person_id(),
          jsonb_build_object('persons', to_jsonb(persons_made), 'households', to_jsonb(homes_made), 'patrols', to_jsonb(patrols_made)))
  returning id into bid;
  return bid;
end;
$$;


create or replace function public.import_advancement(p_org uuid, p_file text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r jsonb; pid uuid; iid uuid; rid uuid; me uuid; aid uuid; prid uuid;
  made_adv uuid[] := '{}'; made_prog uuid[] := '{}'; matched int := 0; skipped int := 0; bid uuid;
begin
  if not public.is_org_admin(p_org) then raise exception 'Only unit admins can import'; end if;
  me := public.my_person_id();
  for r in select * from jsonb_array_elements(p_rows) loop
    select p.id into pid from public.persons p join public.memberships m on m.person_id = p.id and m.org_id = p_org
      where (p.member_id is not null and p.member_id = nullif(trim(r->>'member_id'), ''))
         or (lower(p.first_name) = lower(trim(r->>'first')) and lower(p.last_name) = lower(trim(r->>'last')))
      order by (p.member_id is not null and p.member_id = nullif(trim(r->>'member_id'), '')) desc limit 1;
    select i.id into iid from public.advancement_items i
      where lower(i.name) = lower(trim(r->>'item'))
         or lower(i.name) = lower(regexp_replace(trim(r->>'item'), '\s*(rank|merit badge)$', '', 'i'))
         or (lower(trim(r->>'item')) = 'eagle' and i.code = 'eagle')
      order by (i.program = 'scouts_bsa') desc limit 1;
    if pid is null or iid is null then skipped := skipped + 1; continue; end if;

    if coalesce(trim(r->>'requirement'), '') <> '' then
      select id into rid from public.advancement_requirements
        where item_id = iid and lower(number) = lower(regexp_replace(trim(r->>'requirement'), '^#', '')) limit 1;
      if rid is null then skipped := skipped + 1; continue; end if;
      insert into public.requirement_progress (org_id, person_id, requirement_id, completed_at, approved_by, approved_at)
      values (p_org, pid, rid, coalesce(nullif(r->>'date', '')::timestamptz, now()), me, coalesce(nullif(r->>'date', '')::timestamptz, now()))
      on conflict (person_id, requirement_id) do nothing returning id into prid;
      if prid is not null then made_prog := made_prog || prid; end if;
    else
      insert into public.scout_advancement (org_id, person_id, item_id, status, completed_at)
      values (p_org, pid, iid, 'completed', coalesce(nullif(r->>'date', '')::timestamptz, now()))
      on conflict (person_id, item_id) do update set status = 'completed', completed_at = excluded.completed_at
      returning id into aid;
      made_adv := made_adv || aid;
    end if;
    matched := matched + 1;
  end loop;
  insert into public.import_batches (org_id, kind, file_name, row_count, created_by, created_ids)
  values (p_org, 'advancement', p_file, matched, me, jsonb_build_object('advancement', to_jsonb(made_adv), 'progress', to_jsonb(made_prog)))
  returning id into bid;
  return jsonb_build_object('batch', bid, 'matched', matched, 'skipped', skipped);
end;
$$;

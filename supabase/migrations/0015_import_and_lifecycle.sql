-- 0015: roster/advancement import with undo, aging-out conversion, treasurer helpers.

create table if not exists public.import_batches (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  kind        text not null check (kind in ('roster','advancement','balances','events')),
  file_name   text,
  row_count   integer not null default 0,
  created_by  uuid references public.persons(id) on delete set null,
  created_at  timestamptz not null default now(),
  undone_at   timestamptz,
  created_ids jsonb not null default '{}'
);
alter table public.import_batches enable row level security;
create policy "imports: admins view" on public.import_batches for select using (public.is_org_admin(org_id));

-- rows: [{first,last,type,birthdate,role,patrol,household}] — household is any key that groups a family.
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
    if pid is not null then continue; end if;

    key := lower(coalesce(nullif(trim(r->>'household'), ''), trim(r->>'last')));
    hid := (homes->>key)::uuid;
    if hid is null then
      insert into public.households (name, org_id) values (initcap(trim(r->>'last')) || ' family', p_org) returning id into hid;
      homes := homes || jsonb_build_object(key, hid);
      homes_made := homes_made || hid;
    end if;

    insert into public.persons (first_name, last_name, type, birthdate)
    values (trim(r->>'first'), trim(r->>'last'), ptype, nullif(r->>'birthdate', '')::date) returning id into pid;
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

create or replace function public.undo_import(p_batch uuid)
returns void language plpgsql security definer set search_path = public as $$
declare b record;
begin
  select * into b from public.import_batches where id = p_batch;
  if b is null or not public.is_org_admin(b.org_id) then raise exception 'Not allowed'; end if;
  if b.undone_at is not null then raise exception 'Already undone'; end if;
  if b.kind = 'roster' then
    delete from public.persons where id in (select (jsonb_array_elements_text(b.created_ids->'persons'))::uuid) and user_id is null;
    delete from public.households h where h.id in (select (jsonb_array_elements_text(b.created_ids->'households'))::uuid)
      and not exists (select 1 from public.household_members hm where hm.household_id = h.id);
    delete from public.patrols where id in (select (jsonb_array_elements_text(b.created_ids->'patrols'))::uuid);
  elsif b.kind = 'advancement' then
    delete from public.requirement_progress where id in (select (jsonb_array_elements_text(b.created_ids->'progress'))::uuid);
    delete from public.scout_advancement where id in (select (jsonb_array_elements_text(b.created_ids->'advancement'))::uuid);
  end if;
  update public.import_batches set undone_at = now() where id = p_batch;
end;
$$;

-- rows: [{first,last,item,requirement,date}] — item is a rank or badge name; requirement optional ("1a").
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
      where lower(p.first_name) = lower(trim(r->>'first')) and lower(p.last_name) = lower(trim(r->>'last')) limit 1;
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

-- A Scout who turns 18 can become an adult member (e.g. Assistant Scoutmaster).
create or replace function public.convert_to_adult(p_org uuid, p_person uuid, p_role text)
returns void language plpgsql security definer as $$
begin
  if not public.is_org_admin(p_org) then raise exception 'Not allowed'; end if;
  update public.persons set type = 'adult' where id = p_person;
  update public.memberships set role = p_role where org_id = p_org and person_id = p_person;
  update public.household_members set is_guardian = false where person_id = p_person;
end;
$$;

-- Claiming a household folds away the empty solo household made at sign-up.
create or replace function public.claim_record(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare cc record; me uuid; old_hid uuid;
begin
  select * into cc from public.claim_codes where code = lower(trim(p_code)) and used_by is null;
  if cc is null then raise exception 'That code is not valid or was already used'; end if;
  me := public.my_person_id();
  if me is null and cc.person_id is not null
     and (select user_id from public.persons where id = cc.person_id) is null
     and (select type from public.persons where id = cc.person_id) = 'adult' then
    update public.persons set user_id = auth.uid() where id = cc.person_id;
  else
    if me is null then
      insert into public.persons (user_id, first_name, last_name, type) values (auth.uid(), 'New', '', 'adult') returning id into me;
    end if;
    select hm.household_id into old_hid from public.household_members hm
      where hm.person_id = me and hm.household_id <> cc.household_id
        and (select count(*) from public.household_members x where x.household_id = hm.household_id) = 1 limit 1;
    insert into public.household_members (household_id, person_id, relation, is_guardian)
    values (cc.household_id, me, 'parent', true) on conflict do nothing;
    if old_hid is not null then delete from public.households where id = old_hid; end if;
  end if;
  update public.claim_codes set used_by = auth.uid() where code = cc.code;
  return cc.household_id;
end;
$$;

-- ---------- treasurer ----------
create or replace function public.is_treasurer(org uuid)
returns boolean language sql stable security definer as $$
  select exists (select 1 from public.memberships m join public.persons p on p.id = m.person_id
                 where m.org_id = org and p.user_id = auth.uid() and m.status = 'active'
                   and (m.role in ('treasurer','committee_chair') or m.is_admin));
$$;

drop policy if exists "ledger: leaders insert" on public.ledger_entries;
create policy "ledger: treasurer insert" on public.ledger_entries for insert with check (public.is_treasurer(org_id));

alter table public.ledger_entries add column if not exists method text;
alter table public.ledger_entries add column if not exists category text;

-- Cash, check, or adjustment recorded by hand; marked manual in the ledger.
create or replace function public.record_manual(p_org uuid, p_household uuid, p_amount int, p_type text, p_method text, p_note text, p_event uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare lid uuid; signed int;
begin
  if not public.is_treasurer(p_org) then raise exception 'Only the treasurer or an admin can record money'; end if;
  if p_type not in ('charge','payment','credit','refund') then raise exception 'Bad type'; end if;
  if p_amount <= 0 then raise exception 'Enter a positive amount'; end if;
  signed := case when p_type = 'charge' then p_amount else -p_amount end;
  insert into public.ledger_entries (org_id, household_id, amount_cents, type, description, event_id, manual, method, created_by)
  values (p_org, p_household, signed, p_type, p_note, p_event, true, p_method, public.my_person_id()) returning id into lid;
  return lid;
end;
$$;

-- Treasurer view of every family's balance in the unit.
create or replace function public.unit_balances(p_org uuid)
returns table (household_id uuid, household_name text, balance_cents bigint, charges bigint, paid bigint, last_activity timestamptz)
language sql stable security definer as $$
  select h.id, h.name, coalesce(sum(l.amount_cents), 0),
         coalesce(sum(l.amount_cents) filter (where l.amount_cents > 0), 0),
         coalesce(-sum(l.amount_cents) filter (where l.amount_cents < 0), 0),
         max(l.created_at)
  from public.households h
  join public.ledger_entries l on l.household_id = h.id and l.org_id = p_org
  where public.is_treasurer(p_org) or public.is_org_leader(p_org)
  group by h.id, h.name
  order by 3 desc;
$$;

-- Households in the unit (for picking who a manual entry is for).
create or replace function public.unit_households(p_org uuid)
returns table (household_id uuid, household_name text, members text)
language sql stable security definer as $$
  select h.id, h.name, string_agg(p.first_name || ' ' || p.last_name, ', ' order by p.type, p.first_name)
  from public.households h
  join public.household_members hm on hm.household_id = h.id
  join public.persons p on p.id = hm.person_id
  where exists (select 1 from public.memberships m where m.person_id = p.id and m.org_id = p_org)
    and (public.is_treasurer(p_org) or public.is_org_leader(p_org))
  group by h.id, h.name order by h.name;
$$;

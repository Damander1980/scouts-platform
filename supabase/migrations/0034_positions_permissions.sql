-- 0034: Positions and permissions, plus a youth-data lockdown.
--
-- WHY: "leader" used to mean any adult role, including the ~50 Committee Members a troop
-- like 999 has. Every one of them could read every family's balance, write medical-form
-- status directly, and (via the API) read every Scout's birthdate, email and phone. Any
-- signed-in user could also forge audit-log rows.
--
-- MODEL
--   * permission_catalog: fixed list of abilities. Some are ADULT-ONLY (a Scout can never
--     hold them) and some also NEED CURRENT YPT (Youth Protection Training on file).
--   * unit_positions: each unit's own job titles ("Quartermaster", "Senior Patrol Leader"),
--     each granting a set of permissions. New units get sensible defaults; admins edit.
--   * position_holders: who holds which position. A person may hold several.
--   * has_perm(org, perm) is the single check. Unit admins (adults) hold every permission.
--   * is_org_leader(org) now means has_perm(org, 'leader') so the ~80 existing policies keep
--     working, but only for real program leaders.
--
-- YOUTH PROTECTION RULES ENFORCED HERE, NOT IN THE APP
--   1. A Scout can never be given an adult-only permission (trigger + checked again at use).
--   2. Private youth data (birthdate, email, phone, member ID) is no longer readable by
--      ordinary members; names stay visible to everyone in the unit.
--   3. Reading private data or medical status needs current YPT on file (unit admins exempt
--      so a new unit can be set up), and every look at someone else's private data is logged.
--   4. Only unit admins assign positions or change what a position can do.

-- ============================================================
-- 1) Permission catalog
-- ============================================================
create table if not exists public.permission_catalog (
  key         text primary key,
  label       text not null,
  description text not null,
  adult_only  boolean not null,
  needs_ypt   boolean not null default false,
  sort        int not null
);
alter table public.permission_catalog enable row level security;
drop policy if exists "perm_catalog: read" on public.permission_catalog;
create policy "perm_catalog: read" on public.permission_catalog for select to authenticated using (true);

insert into public.permission_catalog (key, label, description, adult_only, needs_ypt, sort) values
  ('leader',             'Unit leader tools',     'Attendance, patrols, advancement sign-off, RSVP changes, skill cards', true,  false, 10),
  ('events.manage',      'Plan events',           'Create and edit events and trip plans',                                false, false, 20),
  ('gear.manage',        'Manage gear',           'Troop equipment and check-outs',                                       false, false, 30),
  ('docs.manage',        'Manage documents',      'Upload and organize unit documents',                                   false, false, 40),
  ('volunteer.manage',   'Volunteers and polls',  'Volunteer shifts and polls',                                           false, false, 50),
  ('site.edit',          'Edit the website',      'Public pages, albums and photos',                                      true,  false, 60),
  ('members.manage',     'Approve families',      'Approve join requests',                                                true,  false, 70),
  ('members.private',    'See private details',   'Birthdates, emails and phone numbers of members, including Scouts',   true,  true,  80),
  ('medical.view',       'See health form status','Who has current health forms on file',                               true,  true,  90),
  ('medical.record',     'Record health forms',   'Mark health forms received',                                           true,  true, 100),
  ('money.view',         'See family accounts',   'Every family''s balance and the unit ledger',                         true,  false,110),
  ('money.manage',       'Treasurer',             'Record payments, dues, budgets and reimbursements',                    true,  false,120),
  ('fundraising.manage', 'Run fundraisers',       'Fundraisers, donation campaigns and goals',                            true,  false,130),
  ('messages.audit',     'Read the message log',  'Every message in the unit, including those to Scouts',                true,  true, 140)
on conflict (key) do update set label = excluded.label, description = excluded.description,
  adult_only = excluded.adult_only, needs_ypt = excluded.needs_ypt, sort = excluded.sort;

-- ============================================================
-- 2) Positions and holders
-- ============================================================
create table if not exists public.unit_positions (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  title       text not null check (length(trim(title)) between 1 and 80),
  audience    text not null default 'adult' check (audience in ('adult','youth')),
  permissions text[] not null default '{}',
  sort        int not null default 100,
  created_at  timestamptz not null default now(),
  unique (org_id, title)
);
alter table public.unit_positions enable row level security;

create table if not exists public.position_holders (
  org_id      uuid not null references public.organizations(id) on delete cascade,
  position_id uuid not null references public.unit_positions(id) on delete cascade,
  person_id   uuid not null references public.persons(id) on delete cascade,
  assigned_by uuid references public.persons(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (position_id, person_id)
);
alter table public.position_holders enable row level security;
create index if not exists idx_position_holders_person on public.position_holders (org_id, person_id);

-- Titles are part of the roster, so everyone in the unit sees them. Only admins change them.
drop policy if exists "positions: org view" on public.unit_positions;
drop policy if exists "positions: admins manage" on public.unit_positions;
create policy "positions: org view" on public.unit_positions for select using (public.is_org_member(org_id));
create policy "positions: admins manage" on public.unit_positions for all
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

drop policy if exists "holders: org view" on public.position_holders;
drop policy if exists "holders: admins manage" on public.position_holders;
create policy "holders: org view" on public.position_holders for select using (public.is_org_member(org_id));
create policy "holders: admins manage" on public.position_holders for all
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- A position's permissions must exist; a youth position can hold no adult-only permission;
-- and no position held by a Scout may gain one.
create or replace function public.guard_position()
returns trigger language plpgsql security definer set search_path = public as $$
declare bad text;
begin
  new.title := trim(new.title);
  select string_agg(x, ', ') into bad from unnest(new.permissions) x
    where not exists (select 1 from public.permission_catalog c where c.key = x);
  if bad is not null then raise exception 'Unknown permission: %', bad; end if;
  new.permissions := array(select distinct x from unnest(new.permissions) x order by x);

  if exists (select 1 from unnest(new.permissions) x join public.permission_catalog c on c.key = x where c.adult_only) then
    if new.audience = 'youth' then
      raise exception 'A Scout position cannot include adult-only permissions';
    end if;
    if tg_op = 'UPDATE' and exists (select 1 from public.position_holders h join public.persons p on p.id = h.person_id
                                    where h.position_id = new.id and p.type = 'youth') then
      raise exception 'A Scout holds this position, so it cannot include adult-only permissions';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_position on public.unit_positions;
create trigger trg_guard_position before insert or update on public.unit_positions
  for each row execute function public.guard_position();

create or replace function public.guard_position_holder()
returns trigger language plpgsql security definer set search_path = public as $$
declare pos record; ptype text;
begin
  select * into pos from public.unit_positions where id = new.position_id;
  if pos is null or pos.org_id <> new.org_id then raise exception 'That position belongs to another unit'; end if;
  if not exists (select 1 from public.memberships m where m.org_id = new.org_id and m.person_id = new.person_id) then
    raise exception 'Only members of this unit can hold its positions';
  end if;
  select type into ptype from public.persons where id = new.person_id;
  if ptype = 'youth' and (pos.audience = 'adult'
      or exists (select 1 from unnest(pos.permissions) x join public.permission_catalog c on c.key = x where c.adult_only)) then
    raise exception 'That position is for adults. Scouts can hold Scout positions only.';
  end if;
  new.assigned_by := coalesce(new.assigned_by, public.my_person_id());
  return new;
end;
$$;
drop trigger if exists trg_guard_position_holder on public.position_holders;
create trigger trg_guard_position_holder before insert or update on public.position_holders
  for each row execute function public.guard_position_holder();

-- Every position change and assignment is audited.
create or replace function public.audit_positions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Deleting a whole unit cascades here; nothing to audit against a unit that is gone.
  if not exists (select 1 from public.organizations where id = coalesce(new.org_id, old.org_id)) then
    return coalesce(new, old);
  end if;
  if tg_table_name = 'unit_positions' then
    insert into public.audit_log (org_id, actor_id, action, target_type, target_id, payload)
    values (coalesce(new.org_id, old.org_id), public.my_person_id(), 'position.' || lower(tg_op), 'position',
            coalesce(new.id, old.id),
            jsonb_build_object('title', coalesce(new.title, old.title), 'from', old.permissions, 'to', new.permissions));
  else
    insert into public.audit_log (org_id, actor_id, action, target_type, target_id, payload)
    values (coalesce(new.org_id, old.org_id), public.my_person_id(),
            case when tg_op = 'DELETE' then 'position.removed' else 'position.assigned' end, 'person',
            coalesce(new.person_id, old.person_id), jsonb_build_object('position', coalesce(new.position_id, old.position_id)));
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_audit_positions on public.unit_positions;
create trigger trg_audit_positions after insert or update or delete on public.unit_positions
  for each row execute function public.audit_positions();
drop trigger if exists trg_audit_holders on public.position_holders;
create trigger trg_audit_holders after insert or delete on public.position_holders
  for each row execute function public.audit_positions();

-- ============================================================
-- 3) The permission check
-- ============================================================
create or replace function public.has_perm(org uuid, perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.memberships m
    join public.persons p on p.id = m.person_id
    left join public.permission_catalog c on c.key = perm
    where m.org_id = org and p.user_id = auth.uid() and m.status = 'active'
      and (
        (m.is_admin and p.type = 'adult')
        or exists (select 1 from public.position_holders h join public.unit_positions u on u.id = h.position_id
                   where h.org_id = org and h.person_id = m.person_id and perm = any(u.permissions))
      )
      -- Checked again at use time, not just at assignment: a Scout never gets adult-only access.
      and (p.type = 'adult' or not coalesce(c.adult_only, true))
      and (m.is_admin or not coalesce(c.needs_ypt, false) or m.ypt_expires >= current_date)
  );
$$;

create or replace function public.my_permissions(p_org uuid)
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(c.key order by c.sort), '{}') from public.permission_catalog c where public.has_perm(p_org, c.key);
$$;

-- Permissions this person would have if their YPT were current (so the app can explain why
-- they can't see something instead of silently hiding it).
create or replace function public.my_ypt_blocked(p_org uuid)
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct c.key), '{}')
  from public.memberships m
  join public.persons p on p.id = m.person_id and p.user_id = auth.uid() and p.type = 'adult'
  join public.position_holders h on h.org_id = m.org_id and h.person_id = m.person_id
  join public.unit_positions u on u.id = h.position_id
  join public.permission_catalog c on c.key = any(u.permissions) and c.needs_ypt
  where m.org_id = p_org and m.status = 'active' and not m.is_admin
    and (m.ypt_expires is null or m.ypt_expires < current_date);
$$;

-- Existing helpers now route through permissions.
create or replace function public.is_org_leader(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_perm(org, 'leader');
$$;

create or replace function public.is_treasurer(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_perm(org, 'money.manage');
$$;

create or replace function public.is_designated(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_perm(org, 'medical.record');
$$;

-- ============================================================
-- 4) Default positions for every unit
-- ============================================================
create or replace function public.seed_unit_positions(p_org uuid)
returns void language plpgsql security definer set search_path = public as $$
declare t text;
begin
  select type into t from public.organizations where id = p_org;
  insert into public.unit_positions (org_id, title, audience, permissions, sort)
  select p_org, d.title, d.audience, d.perms, d.sort from (values
    -- Top leader and assistants, by program
    (case t when 'cubs' then 'Cubmaster' when 'venturing' then 'Crew Advisor' when 'sea' then 'Skipper' else 'Scoutmaster' end,
      'adult', array['leader','events.manage','members.private','medical.view','medical.record','messages.audit','gear.manage','docs.manage','volunteer.manage'], 10),
    (case t when 'cubs' then 'Assistant Cubmaster' when 'venturing' then 'Associate Advisor' when 'sea' then 'Mate' else 'Assistant Scoutmaster' end,
      'adult', array['leader','events.manage','members.private','medical.view'], 20),
    -- Committee
    ('Committee Chair', 'adult', array['members.manage','members.private','money.view','messages.audit','events.manage','docs.manage','volunteer.manage'], 30),
    ('Chartered Organization Representative', 'adult', array['money.view','messages.audit'], 35),
    ('Treasurer', 'adult', array['money.view','money.manage','fundraising.manage'], 40),
    -- Advancement sign-off lives on the 'leader' tools today.
    ('Advancement Chair', 'adult', array['leader'], 45),
    ('Health and Safety Coordinator', 'adult', array['medical.view','medical.record','members.private'], 50),
    ('Membership Coordinator', 'adult', array['members.manage'], 55),
    ('Fundraising Coordinator', 'adult', array['fundraising.manage'], 60),
    ('Quartermaster', 'adult', array['gear.manage'], 65),
    ('Outdoor Activities Coordinator', 'adult', array['events.manage'], 70),
    ('Webmaster', 'adult', array['site.edit'], 75),
    ('Committee Member', 'adult', array[]::text[], 80),
    ('Scouter Reserve', 'adult', array[]::text[], 90)
  ) as d(title, audience, perms, sort)
  on conflict (org_id, title) do nothing;

  if t = 'cubs' then
    insert into public.unit_positions (org_id, title, audience, permissions, sort) values
      (p_org, 'Den Leader', 'adult', array['leader','events.manage','members.private','medical.view'], 25),
      (p_org, 'Den Chief', 'youth', array[]::text[], 210)
    on conflict (org_id, title) do nothing;
  else
    -- Youth-led unit: Scouts run real parts of the program, within youth-safe permissions.
    insert into public.unit_positions (org_id, title, audience, permissions, sort) values
      (p_org, 'Senior Patrol Leader', 'youth', array['events.manage','volunteer.manage'], 200),
      (p_org, 'Assistant Senior Patrol Leader', 'youth', array['events.manage','volunteer.manage'], 205),
      (p_org, 'Scout Quartermaster', 'youth', array['gear.manage'], 210),
      (p_org, 'Scribe', 'youth', array['volunteer.manage','docs.manage'], 215),
      (p_org, 'Librarian', 'youth', array['docs.manage'], 220),
      (p_org, 'Historian', 'youth', array[]::text[], 225),
      (p_org, 'Troop Guide', 'youth', array[]::text[], 230),
      (p_org, 'Den Chief', 'youth', array[]::text[], 235)
    on conflict (org_id, title) do nothing;
  end if;
end;
$$;

create or replace function public.seed_positions_on_org()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_unit_positions(new.id);
  return new;
end;
$$;
drop trigger if exists trg_seed_positions on public.organizations;
create trigger trg_seed_positions after insert on public.organizations
  for each row execute function public.seed_positions_on_org();

-- The old role column keeps working: a role maps to its default position.
create or replace function public.role_position_title(p_role text, p_org_type text)
returns text language sql immutable as $$
  select case p_role
    when 'scoutmaster' then 'Scoutmaster'
    when 'assistant_scoutmaster' then case p_org_type when 'cubs' then 'Assistant Cubmaster' when 'venturing' then 'Associate Advisor' when 'sea' then 'Mate' else 'Assistant Scoutmaster' end
    when 'cubmaster' then 'Cubmaster'
    when 'crew_advisor' then 'Crew Advisor'
    when 'skipper' then 'Skipper'
    when 'den_leader' then 'Den Leader'
    when 'committee_chair' then 'Committee Chair'
    when 'committee_member' then 'Committee Member'
    when 'treasurer' then 'Treasurer'
    when 'advancement_chair' then 'Advancement Chair'
    when 'chartered_org_rep' then 'Chartered Organization Representative'
  end;
$$;

create or replace function public.sync_role_position()
returns trigger language plpgsql security definer set search_path = public as $$
declare t text; old_title text; new_title text;
begin
  select type into t from public.organizations where id = new.org_id;
  new_title := public.role_position_title(new.role, t);
  if tg_op = 'UPDATE' and old.role is distinct from new.role then
    old_title := public.role_position_title(old.role, t);
    delete from public.position_holders h using public.unit_positions u
      where u.id = h.position_id and u.org_id = new.org_id and u.title = old_title and h.person_id = new.person_id;
  end if;
  if new_title is not null and (tg_op = 'INSERT' or old.role is distinct from new.role) then
    insert into public.position_holders (org_id, position_id, person_id)
    select new.org_id, u.id, new.person_id from public.unit_positions u
    join public.persons p on p.id = new.person_id and p.type = 'adult'
    where u.org_id = new.org_id and u.title = new_title
    on conflict do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_sync_role_position on public.memberships;
create trigger trg_sync_role_position after insert or update of role on public.memberships
  for each row execute function public.sync_role_position();

-- Backfill: seed every existing unit, then give current members their matching positions,
-- from both the role and the free-text position field (e.g. "Quartermaster").
do $$
declare o record;
begin
  for o in select id from public.organizations loop
    perform public.seed_unit_positions(o.id);
  end loop;
end $$;

insert into public.position_holders (org_id, position_id, person_id)
select m.org_id, u.id, m.person_id
from public.memberships m
join public.organizations o on o.id = m.org_id
join public.persons p on p.id = m.person_id and p.type = 'adult'
join public.unit_positions u on u.org_id = m.org_id
  and (u.title = public.role_position_title(m.role, o.type) or lower(u.title) = lower(trim(m.position)))
  and u.audience = 'adult'
on conflict do nothing;

-- ============================================================
-- 5) Lock private columns on persons. Names stay visible to the unit.
-- ============================================================
-- Row-level security decides WHICH people you can see; these grants decide WHICH FIELDS.
-- Birthdate, email, phone and member ID are readable only through person_private() below.
revoke select, update on public.persons from anon, authenticated;
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ') into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'persons'
    and column_name not in ('birthdate', 'email', 'phone', 'member_id');
  execute format('grant select (%s) on public.persons to authenticated', cols);
end $$;
-- Updates still go through row policies (self, guardian, admin). user_id is deliberately
-- not updatable from the client: linking a login to a person happens only in vetted functions.
grant update (first_name, last_name, nickname, birthdate, email, phone, member_id, photo_consent, photo_consent_at)
  on public.persons to authenticated;

-- Private details: your own family always; otherwise members.private (adult, current YPT).
-- Every look at someone outside your family is logged.
create or replace function public.person_private(p_org uuid, p_ids uuid[])
returns table (id uuid, birthdate date, email text, phone text, member_id text)
language plpgsql security definer set search_path = public as $$
declare staff boolean; others int;
begin
  staff := p_org is not null and public.has_perm(p_org, 'members.private');
  select count(*) into others from public.persons x
    where x.id = any(p_ids) and not public.can_act_for(x.id)
      and exists (select 1 from public.memberships m where m.person_id = x.id and m.org_id = p_org);
  if staff and others > 0 then
    insert into public.audit_log (org_id, actor_id, action, target_type, payload)
    values (p_org, public.my_person_id(), 'private.viewed', 'persons', jsonb_build_object('count', others));
  end if;
  return query
    select x.id, x.birthdate, x.email, x.phone, x.member_id from public.persons x
    where x.id = any(p_ids)
      and (public.can_act_for(x.id)
           or (staff and exists (select 1 from public.memberships m where m.person_id = x.id and m.org_id = p_org)));
end;
$$;

-- Event safety check (two adults 21+) without revealing anyone's birthdate.
create or replace function public.member_age_flags(p_org uuid, p_on date)
returns table (person_id uuid, adult_21 boolean)
language sql stable security definer set search_path = public as $$
  select m.person_id, (p.type = 'adult' and (p.birthdate is null or p.birthdate <= p_on - interval '21 years'))
  from public.memberships m join public.persons p on p.id = m.person_id
  where m.org_id = p_org and m.status = 'active' and public.is_org_member(p_org);
$$;

-- ============================================================
-- 6) Close the specific holes
-- ============================================================
-- Health forms: anyone counted as a "leader" could write these directly, skipping the
-- designated-leader check and the audit trail. Writes now go only through mark_form().
drop policy if exists "forms: leaders manage" on public.forms;
drop policy if exists "forms: medical view" on public.forms;
create policy "forms: medical view" on public.forms for select
  using (public.has_perm(org_id, 'medical.view') or public.has_perm(org_id, 'medical.record'));

-- Audit log: anyone signed in could insert any row for any unit.
drop policy if exists "audit: service insert" on public.audit_log;
drop policy if exists "audit: own actions" on public.audit_log;
create policy "audit: own actions" on public.audit_log for insert to authenticated
  with check (actor_id = public.my_person_id() and (org_id is null or public.is_org_member(org_id)));
drop policy if exists "audit: leaders read" on public.audit_log;
drop policy if exists "audit: admins read" on public.audit_log;
create policy "audit: admins read" on public.audit_log for select
  using (public.is_org_admin(org_id) or public.has_perm(org_id, 'messages.audit'));

-- Family ledgers: every leader could see every family's account.
drop policy if exists "ledger: leaders view" on public.ledger_entries;
drop policy if exists "ledger: money view" on public.ledger_entries;
create policy "ledger: money view" on public.ledger_entries for select using (public.has_perm(org_id, 'money.view'));

create or replace function public.unit_balances(p_org uuid)
returns table (household_id uuid, household_name text, balance_cents bigint, charges bigint, paid bigint, last_activity timestamptz)
language sql stable security definer set search_path = public as $$
  select h.id, h.name, coalesce(sum(l.amount_cents), 0),
         coalesce(sum(l.amount_cents) filter (where l.amount_cents > 0), 0),
         coalesce(-sum(l.amount_cents) filter (where l.amount_cents < 0), 0),
         max(l.created_at)
  from public.households h
  join public.ledger_entries l on l.household_id = h.id and l.org_id = p_org
  where public.has_perm(p_org, 'money.view')
  group by h.id, h.name
  order by 3 desc;
$$;

create or replace function public.unit_households(p_org uuid)
returns table (household_id uuid, household_name text, members text)
language sql stable security definer set search_path = public as $$
  select h.id, h.name, string_agg(p.first_name || ' ' || p.last_name, ', ' order by p.type, p.first_name)
  from public.households h
  join public.household_members hm on hm.household_id = h.id
  join public.persons p on p.id = hm.person_id
  where exists (select 1 from public.memberships m where m.person_id = p.id and m.org_id = p_org)
    and (public.has_perm(p_org, 'money.view') or public.is_org_leader(p_org) or public.has_perm(p_org, 'members.manage'))
  group by h.id, h.name order by h.name;
$$;

create or replace function public.dues_status(p_plan uuid)
returns table (person_id uuid, first_name text, last_name text, household_id uuid, household_name text,
               charged_cents bigint, adjusted_cents bigint, family_balance_cents bigint)
language sql stable security definer set search_path = public as $$
  with pl as (select * from public.dues_plans where id = p_plan)
  select p.id, p.first_name, p.last_name, h.id, h.name,
    coalesce((select sum(l.amount_cents) from public.ledger_entries l where l.dues_plan_id = p_plan and l.person_id = p.id and l.type = 'charge'), 0),
    coalesce((select -sum(l.amount_cents) from public.ledger_entries l where l.person_id = p.id and l.type = 'credit' and l.description like 'Dues adjustment:%'
              and l.created_at >= (select created_at from pl)), 0),
    coalesce((select sum(l.amount_cents) from public.ledger_entries l where l.household_id = h.id and l.org_id = (select org_id from pl)), 0)
  from pl
  join public.memberships m on m.org_id = pl.org_id and m.status = 'active'
  join public.persons p on p.id = m.person_id and (pl.applies_to = 'all' or (pl.applies_to = 'youth' and p.type = 'youth') or (pl.applies_to = 'adults' and p.type = 'adult'))
  left join public.households h on h.id = public.person_household(p.id)
  where public.has_perm(pl.org_id, 'money.view')
  order by p.last_name, p.first_name;
$$;

-- Unit money summaries: leaders keep the read-only summary view, plus anyone with money.view.
drop policy if exists "budgets: leaders view" on public.budgets;
create policy "budgets: leaders view" on public.budgets for select using (public.is_org_leader(org_id) or public.has_perm(org_id, 'money.view'));
drop policy if exists "budget_lines: leaders view" on public.budget_lines;
create policy "budget_lines: leaders view" on public.budget_lines for select using (public.is_org_leader(org_id) or public.has_perm(org_id, 'money.view'));
drop policy if exists "unit_tx: leaders view" on public.unit_transactions;
create policy "unit_tx: leaders view" on public.unit_transactions for select using (public.is_org_leader(org_id) or public.has_perm(org_id, 'money.view'));
drop policy if exists "dues_plans: leaders view" on public.dues_plans;
create policy "dues_plans: leaders view" on public.dues_plans for select using (public.is_org_leader(org_id) or public.has_perm(org_id, 'money.view'));

-- Fundraising can be delegated without handing over the treasury.
drop policy if exists "fundraisers: treasurer manage" on public.fundraisers;
create policy "fundraisers: treasurer manage" on public.fundraisers for all
  using (public.is_treasurer(org_id) or public.has_perm(org_id, 'fundraising.manage'))
  with check (public.is_treasurer(org_id) or public.has_perm(org_id, 'fundraising.manage'));
drop policy if exists "campaigns: treasurer manage" on public.donation_campaigns;
create policy "campaigns: treasurer manage" on public.donation_campaigns for all
  using (public.is_treasurer(org_id) or public.has_perm(org_id, 'fundraising.manage'))
  with check (public.is_treasurer(org_id) or public.has_perm(org_id, 'fundraising.manage'));
drop policy if exists "goals: treasurer manage" on public.fundraising_goals;
create policy "goals: treasurer manage" on public.fundraising_goals for all
  using (public.is_treasurer(org_id) or public.has_perm(org_id, 'fundraising.manage'))
  with check (public.is_treasurer(org_id) or public.has_perm(org_id, 'fundraising.manage'));
drop policy if exists "sales: view" on public.fundraiser_sales;
create policy "sales: view" on public.fundraiser_sales for select
  using (public.is_org_leader(org_id) or public.has_perm(org_id, 'fundraising.manage') or public.can_act_for(scout_id));
drop policy if exists "sales: record" on public.fundraiser_sales;
create policy "sales: record" on public.fundraiser_sales for insert
  with check (public.is_org_leader(org_id) or public.has_perm(org_id, 'fundraising.manage') or public.can_act_for(scout_id));

-- Events and trip plans: leaders, or anyone (adult or Scout) given event planning.
drop policy if exists "events: leaders manage" on public.events;
create policy "events: leaders manage" on public.events for all
  using (public.is_org_leader(org_id) or public.has_perm(org_id, 'events.manage'))
  with check (public.is_org_leader(org_id) or public.has_perm(org_id, 'events.manage'));
drop policy if exists "trip_plans: leaders manage" on public.trip_plans;
create policy "trip_plans: leaders manage" on public.trip_plans for all
  using (public.is_org_leader(org_id) or public.has_perm(org_id, 'events.manage'))
  with check (public.is_org_leader(org_id) or public.has_perm(org_id, 'events.manage'));

-- Gear.
drop policy if exists "equip: leaders manage" on public.equipment;
create policy "equip: leaders manage" on public.equipment for all
  using (public.is_org_leader(org_id) or public.has_perm(org_id, 'gear.manage'))
  with check (public.is_org_leader(org_id) or public.has_perm(org_id, 'gear.manage'));
drop policy if exists "checkouts: leaders manage" on public.checkouts;
create policy "checkouts: leaders manage" on public.checkouts for all
  using (public.is_org_leader(org_id) or public.has_perm(org_id, 'gear.manage'))
  with check (public.is_org_leader(org_id) or public.has_perm(org_id, 'gear.manage'));

-- Documents.
drop policy if exists "docs: view" on public.documents;
create policy "docs: view" on public.documents for select using (
  visibility = 'public' or (visibility = 'members' and public.is_org_member(org_id))
  or public.is_org_leader(org_id) or public.has_perm(org_id, 'docs.manage'));
drop policy if exists "docs: leaders manage" on public.documents;
create policy "docs: leaders manage" on public.documents for all
  using (public.is_org_leader(org_id) or public.has_perm(org_id, 'docs.manage'))
  with check (public.is_org_leader(org_id) or public.has_perm(org_id, 'docs.manage'));

-- Volunteer shifts and polls.
drop policy if exists "shifts: leaders manage" on public.shifts;
create policy "shifts: leaders manage" on public.shifts for all
  using (public.is_org_leader(org_id) or public.has_perm(org_id, 'volunteer.manage'))
  with check (public.is_org_leader(org_id) or public.has_perm(org_id, 'volunteer.manage'));
drop policy if exists "shift_signups: family manage" on public.shift_signups;
create policy "shift_signups: family manage" on public.shift_signups for all
  using (public.can_act_for(person_id) or public.is_org_leader(org_id) or public.has_perm(org_id, 'volunteer.manage'))
  with check (public.can_act_for(person_id) or public.is_org_leader(org_id) or public.has_perm(org_id, 'volunteer.manage'));
drop policy if exists "polls: create" on public.polls;
create policy "polls: create" on public.polls for insert with check (
  public.is_org_leader(org_id) or public.has_perm(org_id, 'volunteer.manage') or exists (
    select 1 from public.patrol_members pm where pm.org_id = polls.org_id and public.is_own_person(pm.person_id)
      and pm.end_date is null and pm.role = 'patrol_leader'));

-- Website and photos (adult-only: photo consent is enforced in the app, not the database).
drop policy if exists "site: editors manage" on public.site_pages;
create policy "site: editors manage" on public.site_pages for all
  using (public.is_org_leader(org_id) or public.has_perm(org_id, 'site.edit'))
  with check (public.is_org_leader(org_id) or public.has_perm(org_id, 'site.edit'));
drop policy if exists "site_hist: leaders" on public.site_page_history;
create policy "site_hist: leaders" on public.site_page_history for select
  using (public.is_org_leader(org_id) or public.has_perm(org_id, 'site.edit'));
drop policy if exists "albums: leaders manage" on public.albums;
create policy "albums: leaders manage" on public.albums for all
  using (public.is_org_leader(org_id) or public.has_perm(org_id, 'site.edit'))
  with check (public.is_org_leader(org_id) or public.has_perm(org_id, 'site.edit'));
drop policy if exists "photos: leaders manage" on public.photos;
create policy "photos: leaders manage" on public.photos for all
  using (public.is_org_leader(org_id) or public.has_perm(org_id, 'site.edit'))
  with check (public.is_org_leader(org_id) or public.has_perm(org_id, 'site.edit'));
drop policy if exists "contact: leaders view" on public.contact_requests;
create policy "contact: leaders view" on public.contact_requests for select
  using (public.is_org_leader(org_id) or public.has_perm(org_id, 'site.edit'));
drop policy if exists "contact: leaders update" on public.contact_requests;
create policy "contact: leaders update" on public.contact_requests for update
  using (public.is_org_leader(org_id) or public.has_perm(org_id, 'site.edit'));
drop policy if exists "site: leaders upload" on storage.objects;
create policy "site: leaders upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'site' and (public.is_org_leader(((storage.foldername(name))[1])::uuid)
                                      or public.has_perm(((storage.foldername(name))[1])::uuid, 'site.edit')));
drop policy if exists "site: leaders delete" on storage.objects;
create policy "site: leaders delete" on storage.objects for delete to authenticated
  using (bucket_id = 'site' and (public.is_org_leader(((storage.foldername(name))[1])::uuid)
                                 or public.has_perm(((storage.foldername(name))[1])::uuid, 'site.edit')));

-- Joining: admins, or a Membership Coordinator, approve families.
drop policy if exists "join_req: requester or leaders view" on public.join_requests;
create policy "join_req: requester or leaders view" on public.join_requests for select using (
  public.is_own_person(requested_by) or public.is_org_admin(org_id) or public.has_perm(org_id, 'members.manage'));

create or replace function public.join_request_people(p_org uuid)
returns table (request_id uuid, person_id uuid, first_name text, last_name text, type text, birthdate date, is_requester boolean)
language sql stable security definer set search_path = public as $$
  select j.id, p.id, p.first_name, p.last_name, p.type, p.birthdate, p.id = j.requested_by
  from public.join_requests j
  join public.persons p on p.id = j.requested_by or p.id = any(j.person_ids)
  where j.org_id = p_org and j.status = 'pending' and public.has_perm(p_org, 'members.manage');
$$;

create or replace function public.decide_join(p_request uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare r record; pid uuid; ptype text;
begin
  select * into r from public.join_requests where id = p_request;
  if r is null or not public.has_perm(r.org_id, 'members.manage') then raise exception 'Only unit admins or the membership coordinator can approve families'; end if;
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

-- Message log: admins, designated leaders, and holders of messages.audit (adult, current YPT).
drop policy if exists "messages: recipients and admins view" on public.message_log;
create policy "messages: recipients and admins view" on public.message_log for select using (
  public.is_org_admin(org_id)
  or public.has_perm(org_id, 'messages.audit')
  or exists (select 1 from public.memberships m where m.org_id = message_log.org_id and m.is_designated_leader and public.is_own_person(m.person_id))
  or public.is_own_person(sender_id)
  or public.is_message_recipient(id));
drop policy if exists "msg_recipients: own view" on public.message_recipients;
create policy "msg_recipients: own view" on public.message_recipients for select using (
  public.is_own_person(person_id) or public.is_org_admin(public.message_org(message_id))
  or public.has_perm(public.message_org(message_id), 'messages.audit'));
drop policy if exists "log_views: admins view" on public.message_log_views;
create policy "log_views: admins view" on public.message_log_views for select
  using (public.is_org_admin(org_id) or public.has_perm(org_id, 'messages.audit'));

grant execute on function public.has_perm(uuid, text) to authenticated;
grant execute on function public.my_permissions(uuid) to authenticated;
grant execute on function public.my_ypt_blocked(uuid) to authenticated;
grant execute on function public.person_private(uuid, uuid[]) to authenticated;
grant execute on function public.member_age_flags(uuid, date) to authenticated;
revoke execute on function public.seed_unit_positions(uuid) from public, anon, authenticated;

-- 0008: Phase 1 core — accounts, households, joining, admins, patrols, positions,
-- guardian access, messaging, notifications, audit.

-- ---------- users mirror ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, display_name)
  values (new.id, coalesce(new.email, new.phone, new.id::text), new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
insert into public.users (id, email)
select id, coalesce(email, phone, id::text) from auth.users on conflict (id) do nothing;

-- ---------- helpers ----------
create or replace function public.my_person_id()
returns uuid language sql stable security definer as $$
  select id from public.persons where user_id = auth.uid() limit 1;
$$;

create or replace function public.is_guardian_of(pid uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.household_members target
    join public.household_members me on me.household_id = target.household_id
    join public.persons p on p.id = me.person_id
    where target.person_id = pid and me.is_guardian and p.user_id = auth.uid()
  );
$$;

create or replace function public.can_act_for(pid uuid)
returns boolean language sql stable security definer as $$
  select public.is_own_person(pid) or public.is_guardian_of(pid);
$$;

-- ---------- households are family-level, not troop-level ----------
alter table public.households alter column org_id drop not null;
alter table public.households add column if not exists created_by uuid references public.persons(id) on delete set null;

drop policy if exists "households: org members view" on public.households;
drop policy if exists "households: leaders manage" on public.households;
create policy "households: members view" on public.households for select using (
  exists (select 1 from public.household_members hm join public.persons p on p.id = hm.person_id
          where hm.household_id = households.id and p.user_id = auth.uid())
  or exists (select 1 from public.household_members hm join public.memberships m on m.person_id = hm.person_id
             where hm.household_id = households.id and public.is_org_leader(m.org_id))
);
create policy "households: guardians update" on public.households for update using (
  exists (select 1 from public.household_members hm join public.persons p on p.id = hm.person_id
          where hm.household_id = households.id and hm.is_guardian and p.user_id = auth.uid())
);

drop policy if exists "hh_members: org members view" on public.household_members;
create policy "hh_members: family and leaders view" on public.household_members for select using (
  exists (select 1 from public.household_members me join public.persons p on p.id = me.person_id
          where me.household_id = household_members.household_id and p.user_id = auth.uid())
  or exists (select 1 from public.memberships m where m.person_id = household_members.person_id and public.is_org_leader(m.org_id))
);

drop policy if exists "persons: own row" on public.persons;
create policy "persons: self or guardian" on public.persons for select using (public.can_act_for(id));
create policy "persons: self or guardian update" on public.persons for update using (public.can_act_for(id));

-- ---------- org admins ----------
alter table public.memberships add column if not exists is_admin boolean not null default false;
alter table public.memberships add column if not exists is_designated_leader boolean not null default false;
alter table public.memberships add column if not exists position text;
alter table public.memberships add column if not exists swim_class text check (swim_class in ('swimmer','beginner','nonswimmer'));
alter table public.memberships add column if not exists contact_opt_in boolean not null default false;

create or replace function public.is_org_admin(org uuid)
returns boolean language sql stable security definer as $$
  select exists (select 1 from public.memberships m join public.persons p on p.id = m.person_id
                 where m.org_id = org and p.user_id = auth.uid() and m.status = 'active' and m.is_admin);
$$;

create or replace function public.guard_last_admin()
returns trigger language plpgsql security definer as $$
declare remaining int;
begin
  if (tg_op = 'DELETE' and old.is_admin)
     or (tg_op = 'UPDATE' and old.is_admin and old.status = 'active' and (not new.is_admin or new.status <> 'active')) then
    select count(*) into remaining from public.memberships
      where org_id = old.org_id and is_admin and status = 'active' and id <> old.id;
    if remaining = 0 then
      raise exception 'A troop must keep at least one active admin';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_guard_last_admin on public.memberships;
create trigger trg_guard_last_admin before update or delete on public.memberships
  for each row execute function public.guard_last_admin();

create or replace function public.audit_membership()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (org_id, actor_id, action, target_type, target_id, payload)
    values (new.org_id, public.my_person_id(), 'membership.created', 'membership', new.id,
            jsonb_build_object('role', new.role, 'person_id', new.person_id));
  elsif new.role is distinct from old.role or new.status is distinct from old.status
        or new.is_admin is distinct from old.is_admin or new.position is distinct from old.position then
    insert into public.audit_log (org_id, actor_id, action, target_type, target_id, payload)
    values (new.org_id, public.my_person_id(), 'membership.changed', 'membership', new.id,
            jsonb_build_object('from', jsonb_build_object('role', old.role, 'status', old.status, 'is_admin', old.is_admin, 'position', old.position),
                               'to',   jsonb_build_object('role', new.role, 'status', new.status, 'is_admin', new.is_admin, 'position', new.position)));
  end if;
  return new;
end;
$$;
drop trigger if exists trg_audit_membership on public.memberships;
create trigger trg_audit_membership after insert or update on public.memberships
  for each row execute function public.audit_membership();

-- ---------- account setup RPCs ----------
create or replace function public.ensure_person(p_first text, p_last text)
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid; hid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into public.users (id, email) select id, coalesce(email, phone, id::text) from auth.users where id = auth.uid()
    on conflict (id) do nothing;
  select id into pid from public.persons where user_id = auth.uid();
  if pid is null then
    insert into public.persons (user_id, first_name, last_name, type)
    values (auth.uid(), coalesce(nullif(trim(p_first), ''), 'New'), coalesce(trim(p_last), ''), 'adult')
    returning id into pid;
  elsif coalesce(trim(p_first), '') <> '' then
    update public.persons set first_name = trim(p_first), last_name = coalesce(trim(p_last), last_name) where id = pid;
  end if;
  if not exists (select 1 from public.household_members where person_id = pid) then
    insert into public.households (name, created_by) values (coalesce(nullif(trim(p_last), ''), 'My') || ' family', pid) returning id into hid;
    insert into public.household_members (household_id, person_id, relation, is_guardian) values (hid, pid, 'parent', true);
    update public.households set billing_contact = pid where id = hid;
  end if;
  return pid;
end;
$$;

create or replace function public.add_child(p_first text, p_last text, p_birthdate date)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid; hid uuid; kid uuid;
begin
  me := public.my_person_id();
  if me is null then raise exception 'Finish your profile first'; end if;
  select household_id into hid from public.household_members where person_id = me and is_guardian limit 1;
  if hid is null then raise exception 'No household found'; end if;
  insert into public.persons (first_name, last_name, birthdate, type)
  values (trim(p_first), trim(p_last), p_birthdate, 'youth') returning id into kid;
  insert into public.household_members (household_id, person_id, relation, is_guardian) values (hid, kid, 'scout', false);
  return kid;
end;
$$;

create table if not exists public.household_invites (
  code         text primary key default substr(md5(random()::text), 1, 8),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by   uuid references public.persons(id) on delete set null,
  used_by      uuid references public.persons(id) on delete set null,
  created_at   timestamptz not null default now()
);
alter table public.household_invites enable row level security;
create policy "hh_invites: guardians view" on public.household_invites for select using (
  exists (select 1 from public.household_members hm join public.persons p on p.id = hm.person_id
          where hm.household_id = household_invites.household_id and hm.is_guardian and p.user_id = auth.uid()));

create or replace function public.create_household_invite()
returns text language plpgsql security definer set search_path = public as $$
declare me uuid; hid uuid; c text;
begin
  me := public.my_person_id();
  select household_id into hid from public.household_members where person_id = me and is_guardian limit 1;
  if hid is null then raise exception 'No household found'; end if;
  insert into public.household_invites (household_id, created_by) values (hid, me) returning code into c;
  return c;
end;
$$;

create or replace function public.accept_household_invite(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid; inv record;
begin
  me := public.my_person_id();
  if me is null then raise exception 'Finish your profile first'; end if;
  select * into inv from public.household_invites where code = lower(trim(p_code)) and used_by is null;
  if inv is null then raise exception 'That family code is not valid or was already used'; end if;
  insert into public.household_members (household_id, person_id, relation, is_guardian)
  values (inv.household_id, me, 'guardian', true) on conflict do nothing;
  update public.household_invites set used_by = me where code = inv.code;
  return inv.household_id;
end;
$$;

create or replace function public.create_organization(p_type text, p_number text, p_city text, p_state text, p_word text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid; oid uuid; base text; s text; n int := 1;
begin
  me := public.my_person_id();
  if me is null then raise exception 'Finish your profile first'; end if;
  base := lower(regexp_replace(p_word || p_number || p_city, '[^A-Za-z0-9]', '', 'g'));
  s := base;
  while exists (select 1 from public.organizations where slug = s) loop n := n + 1; s := base || n; end loop;
  insert into public.organizations (name, type, unit_number, city, state, slug)
  values (trim(p_word || ' ' || p_number), p_type, trim(p_number), trim(p_city), nullif(trim(p_state), ''), s)
  returning id into oid;
  insert into public.memberships (org_id, person_id, role, status, is_admin, is_designated_leader)
  values (oid, me, case p_type when 'cubs' then 'cubmaster' when 'venturing' then 'crew_advisor' when 'sea' then 'skipper' else 'scoutmaster' end,
          'active', true, true);
  return oid;
end;
$$;

-- ---------- joining a troop ----------
create table if not exists public.join_requests (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid not null references public.persons(id) on delete cascade,
  person_ids  uuid[] not null,
  note        text,
  status      text not null default 'pending' check (status in ('pending','approved','declined')),
  decided_by  uuid references public.persons(id) on delete set null,
  decided_at  timestamptz,
  created_at  timestamptz not null default now()
);
alter table public.join_requests enable row level security;
create policy "join_req: requester or leaders view" on public.join_requests for select using (
  public.is_own_person(requested_by) or public.is_org_leader(org_id));

create or replace function public.lookup_org(p_code text)
returns table (id uuid, name text, type text, city text, state text)
language sql stable security definer as $$
  select o.id, o.name, o.type, o.city, o.state from public.organizations o
  where o.join_code = lower(trim(p_code)) or o.slug = lower(trim(p_code)) limit 1;
$$;

create or replace function public.request_join(p_org uuid, p_person_ids uuid[], p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid; pid uuid; rid uuid;
begin
  me := public.my_person_id();
  if me is null then raise exception 'Finish your profile first'; end if;
  foreach pid in array p_person_ids loop
    if not public.can_act_for(pid) then raise exception 'You can only request to join for yourself and your family'; end if;
  end loop;
  insert into public.join_requests (org_id, requested_by, person_ids, note)
  values (p_org, me, p_person_ids, p_note) returning id into rid;
  return rid;
end;
$$;

create or replace function public.decide_join(p_request uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare r record; pid uuid; ptype text;
begin
  select * into r from public.join_requests where id = p_request;
  if r is null or not public.is_org_leader(r.org_id) then raise exception 'Not allowed'; end if;
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

-- ---------- patrols and positions ----------
create table if not exists public.patrols (
  id         uuid primary key default uuid_generate_v4(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  name       text not null,
  kind       text not null default 'patrol' check (kind in ('patrol','new_scout','den','crew_team')),
  emblem     text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.patrols enable row level security;
create policy "patrols: org view" on public.patrols for select using (public.is_org_member(org_id));
create policy "patrols: leaders manage" on public.patrols for all using (public.is_org_leader(org_id)) with check (public.is_org_leader(org_id));

create table if not exists public.patrol_members (
  id         uuid primary key default uuid_generate_v4(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  patrol_id  uuid not null references public.patrols(id) on delete cascade,
  person_id  uuid not null references public.persons(id) on delete cascade,
  role       text not null default 'member' check (role in ('member','patrol_leader','assistant_patrol_leader','troop_guide','adult_advisor','den_leader','den_chief')),
  start_date date not null default current_date,
  end_date   date
);
alter table public.patrol_members enable row level security;
create index if not exists idx_patrol_members_person on public.patrol_members (person_id) where end_date is null;
create policy "patrol_members: org view" on public.patrol_members for select using (public.is_org_member(org_id));
create policy "patrol_members: leaders manage" on public.patrol_members for all using (public.is_org_leader(org_id)) with check (public.is_org_leader(org_id));

create table if not exists public.leadership_positions (
  id         uuid primary key default uuid_generate_v4(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  person_id  uuid not null references public.persons(id) on delete cascade,
  title      text not null,
  start_date date not null default current_date,
  end_date   date,
  counts_for_rank boolean not null default true,
  created_by uuid references public.persons(id) on delete set null
);
alter table public.leadership_positions enable row level security;
create policy "positions: org view" on public.leadership_positions for select using (public.is_org_member(org_id));
create policy "positions: leaders manage" on public.leadership_positions for all using (public.is_org_leader(org_id)) with check (public.is_org_leader(org_id));

-- ---------- events & RSVPs for families ----------
alter table public.events add column if not exists kind text not null default 'event'
  check (kind in ('meeting','campout','service','fundraiser','event','high_adventure'));
alter table public.events add column if not exists visibility text not null default 'members' check (visibility in ('public','members'));
alter table public.events add column if not exists overnight_nights integer not null default 0;
alter table public.events add column if not exists service_hours numeric not null default 0;
alter table public.events add column if not exists miles numeric not null default 0;
alter table public.events add column if not exists needs_permission boolean not null default false;
alter table public.events add column if not exists questions jsonb not null default '[]';
alter table public.events add column if not exists canceled boolean not null default false;

create policy "events: public view" on public.events for select using (visibility = 'public');

alter table public.rsvps add column if not exists answers jsonb not null default '{}';
alter table public.rsvps add column if not exists dietary text;
alter table public.rsvps add column if not exists updated_by uuid references public.persons(id) on delete set null;
alter table public.rsvps add column if not exists updated_at timestamptz not null default now();

drop policy if exists "rsvps: own person" on public.rsvps;
drop policy if exists "rsvps: leaders view" on public.rsvps;
create policy "rsvps: org view" on public.rsvps for select using (
  exists (select 1 from public.events e where e.id = event_id and public.is_org_member(e.org_id)));
create policy "rsvps: family manage" on public.rsvps for all using (public.can_act_for(person_id))
  with check (public.can_act_for(person_id));
create policy "rsvps: leaders manage" on public.rsvps for all using (
  exists (select 1 from public.events e where e.id = event_id and public.is_org_leader(e.org_id)))
  with check (exists (select 1 from public.events e where e.id = event_id and public.is_org_leader(e.org_id)));

-- Roster names are visible across the troop; contact details are not part of persons.
create policy "persons: org roster view" on public.persons for select using (
  exists (select 1 from public.memberships m where m.person_id = persons.id and public.is_org_member(m.org_id)));

-- ---------- messaging ----------
alter table public.message_log add column if not exists audience text;
alter table public.message_log add column if not exists audience_ref uuid;
alter table public.message_recipients add column if not exists copy_reason text;
alter table public.message_recipients add column if not exists read_at timestamptz;

drop policy if exists "messages: org members view" on public.message_log;
drop policy if exists "msg_recipients: org members view" on public.message_recipients;
create policy "messages: recipients and admins view" on public.message_log for select using (
  public.is_org_admin(org_id)
  or exists (select 1 from public.memberships m where m.org_id = message_log.org_id and m.is_designated_leader and public.is_own_person(m.person_id))
  or public.is_own_person(sender_id)
  or exists (select 1 from public.message_recipients r where r.message_id = message_log.id and public.is_own_person(r.person_id)));
create policy "msg_recipients: own view" on public.message_recipients for select using (public.is_own_person(person_id)
  or exists (select 1 from public.message_log ml where ml.id = message_id and public.is_org_admin(ml.org_id)));
create policy "msg_recipients: mark read" on public.message_recipients for update using (public.is_own_person(person_id));

create table if not exists public.message_log_views (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  viewer_id uuid references public.persons(id) on delete set null,
  viewed_at timestamptz not null default now()
);
alter table public.message_log_views enable row level security;
create policy "log_views: admins view" on public.message_log_views for select using (public.is_org_admin(org_id));

-- Sends a message and fans it out with youth-protection copies.
create or replace function public.send_message(
  p_org uuid, p_subject text, p_body text, p_audience text, p_ref uuid, p_person_ids uuid[]
) returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid; mid uuid; leader boolean; pl boolean;
begin
  me := public.my_person_id();
  if me is null or not public.is_org_member(p_org) then raise exception 'Not allowed'; end if;
  leader := public.is_org_leader(p_org);
  pl := exists (select 1 from public.patrol_members pm where pm.person_id = me and pm.end_date is null
                and pm.role in ('patrol_leader','assistant_patrol_leader') and pm.org_id = p_org);
  if p_audience in ('troop','nonresponders','event') and not leader then raise exception 'Only leaders can message the whole troop'; end if;
  if p_audience = 'patrol' and not (leader or (pl and exists (select 1 from public.patrol_members where person_id = me and patrol_id = p_ref and end_date is null))) then
    raise exception 'Only leaders or that patrol''s leaders can message a patrol';
  end if;

  insert into public.message_log (org_id, sender_id, subject, body, channel, audience, audience_ref, event_id)
  values (p_org, me, nullif(trim(p_subject), ''), p_body, 'in_app', p_audience, p_ref,
          case when p_audience in ('event','nonresponders') then p_ref end)
  returning id into mid;

  create temp table if not exists _rcpt (person_id uuid, reason text) on commit drop;
  delete from _rcpt;

  if p_audience = 'troop' then
    insert into _rcpt select m.person_id, 'direct' from public.memberships m where m.org_id = p_org and m.status = 'active';
  elsif p_audience = 'patrol' then
    insert into _rcpt select pm.person_id, 'direct' from public.patrol_members pm where pm.patrol_id = p_ref and pm.end_date is null;
  elsif p_audience = 'event' then
    insert into _rcpt select r.person_id, 'direct' from public.rsvps r where r.event_id = p_ref and r.status = 'going';
  elsif p_audience = 'nonresponders' then
    insert into _rcpt select m.person_id, 'direct' from public.memberships m
      where m.org_id = p_org and m.status = 'active'
        and not exists (select 1 from public.rsvps r where r.event_id = p_ref and r.person_id = m.person_id);
  elsif p_audience = 'people' then
    insert into _rcpt select unnest(p_person_ids), 'direct';
  else
    raise exception 'Unknown audience';
  end if;

  -- Guardians of every youth recipient
  insert into _rcpt select g.person_id, 'parent_copy'
  from _rcpt r join public.persons p on p.id = r.person_id and p.type = 'youth'
  join public.household_members kid on kid.person_id = r.person_id
  join public.household_members g on g.household_id = kid.household_id and g.is_guardian;

  -- Designated leaders whenever any youth is involved (sender or recipient)
  if exists (select 1 from _rcpt r join public.persons p on p.id = r.person_id where p.type = 'youth')
     or exists (select 1 from public.persons where id = me and type = 'youth') then
    insert into _rcpt select m.person_id, 'leader_copy' from public.memberships m
      where m.org_id = p_org and m.status = 'active' and m.is_designated_leader;
  end if;

  insert into public.message_recipients (message_id, person_id, copy_reason)
  select mid, person_id, min(reason) from _rcpt where person_id <> me group by person_id
  on conflict do nothing;
  insert into public.message_recipients (message_id, person_id, copy_reason, read_at)
  values (mid, me, 'sender', now()) on conflict do nothing;
  return mid;
end;
$$;

-- ---------- notification preferences ----------
create table if not exists public.notification_prefs (
  person_id     uuid primary key references public.persons(id) on delete cascade,
  email_on      boolean not null default true,
  push_on       boolean not null default true,
  sms_on        boolean not null default false,
  sms_phone     text,
  sms_consent_at timestamptz,
  sms_consent_text text,
  categories    jsonb not null default '{"reminders":true,"deadlines":true,"payments":true,"messages":true,"digest":true,"urgent":true}',
  quiet_start   time not null default '21:00',
  quiet_end     time not null default '08:00',
  digest_day    text not null default 'sun',
  timezone      text not null default 'America/Chicago',
  updated_at    timestamptz not null default now()
);
alter table public.notification_prefs enable row level security;
create policy "notif: own" on public.notification_prefs for all using (public.is_own_person(person_id)) with check (public.is_own_person(person_id));

create table if not exists public.notification_log (
  id uuid primary key default uuid_generate_v4(),
  person_id uuid references public.persons(id) on delete cascade,
  channel text not null, category text, status text not null default 'queued',
  provider_id text, created_at timestamptz not null default now()
);
alter table public.notification_log enable row level security;
create policy "notif_log: own" on public.notification_log for select using (public.is_own_person(person_id));

-- ---------- forms: leaders who can see ----------
alter table public.forms add column if not exists status text not null default 'received' check (status in ('received','missing'));

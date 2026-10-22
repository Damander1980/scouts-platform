-- Import and attendance fixes.
-- * Undoing an advancement import deleted awards that were already recorded (a rank signed off by
--   hand that the file also listed). Now only rows the import created are undone, and an existing
--   completion's date is never overwritten.
-- * Imported dates ('2026-03-15') were read as UTC midnight, the evening before in Texas: dates now
--   land on the written day (noon in the unit's zone).
-- * Name matching for imports: Scouts only, and a name shared by two Scouts is skipped as ambiguous
--   (John Smith Sr. no longer gets John Jr.'s merit badge or camping nights).
-- * One unreadable date no longer aborts a whole activity import; that row is skipped.
-- * Weekly meetings keep their local time across daylight saving (7pm stays 7pm in November).
-- * Attendance totals use the unit's calendar days and skip unconfirmed QR check-ins.
-- * QR check-in refuses canceled events and reports only people actually checked in.

create or replace function public.unit_tz(p_org uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(settings->>'time_zone', ''), 'America/Chicago') from public.organizations where id = p_org;
$$;

-- A written date (YYYY-MM-DD, or anything Postgres reads as a date) as noon that day in the unit's zone; null if unreadable.
create or replace function public.import_date(p_text text, p_org uuid)
returns timestamptz language plpgsql stable set search_path = public as $$
begin
  if coalesce(trim(p_text), '') = '' then return null; end if;
  return ((trim(p_text))::date + time '12:00') at time zone public.unit_tz(p_org);
exception when others then return null;
end;
$$;

-- The one Scout in the unit with this Scoutbook member ID, or else this exact name (null if none or several).
create or replace function public.import_match_scout(p_org uuid, p_member_id text, p_first text, p_last text)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare pid uuid; n int;
begin
  if nullif(trim(p_member_id), '') is not null then
    select p.id into pid from public.persons p join public.memberships m on m.person_id = p.id and m.org_id = p_org
      where p.member_id = trim(p_member_id) limit 1;
    if pid is not null then return pid; end if;
  end if;
  select count(*), min(p.id::text)::uuid into n, pid from public.persons p join public.memberships m on m.person_id = p.id and m.org_id = p_org
    where p.type = 'youth' and lower(p.first_name) = lower(trim(p_first)) and lower(p.last_name) = lower(trim(p_last));
  return case when n = 1 then pid end;
end;
$$;
revoke execute on function public.import_match_scout(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.import_advancement(p_org uuid, p_file text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r jsonb; pid uuid; iid uuid; rid uuid; me uuid; aid uuid; prid uuid; d timestamptz;
  made_adv uuid[] := '{}'; made_prog uuid[] := '{}'; matched int := 0; skipped int := 0; bid uuid;
begin
  if not public.is_org_admin(p_org) then raise exception 'Only unit admins can import'; end if;
  me := public.my_person_id();
  for r in select * from jsonb_array_elements(p_rows) loop
    pid := public.import_match_scout(p_org, r->>'member_id', r->>'first', r->>'last');
    select i.id into iid from public.advancement_items i
      where lower(i.name) = lower(trim(r->>'item'))
         or lower(i.name) = lower(regexp_replace(trim(r->>'item'), '\s*(rank|merit badge)$', '', 'i'))
         or (lower(trim(r->>'item')) = 'eagle' and i.code = 'eagle')
      order by (i.program = 'scouts_bsa') desc limit 1;
    if pid is null or iid is null then skipped := skipped + 1; continue; end if;
    d := coalesce(public.import_date(r->>'date', p_org), now());

    if coalesce(trim(r->>'requirement'), '') <> '' then
      select id into rid from public.advancement_requirements
        where item_id = iid and lower(number) = lower(regexp_replace(trim(r->>'requirement'), '^#', '')) limit 1;
      if rid is null then skipped := skipped + 1; continue; end if;
      prid := null;
      insert into public.requirement_progress (org_id, person_id, requirement_id, completed_at, approved_by, approved_at)
      values (p_org, pid, rid, d, me, d)
      on conflict (person_id, requirement_id) do nothing returning id into prid;
      if prid is not null then made_prog := made_prog || prid; end if;
    else
      aid := null;
      -- Only a new record (or an in-progress one becoming complete) is the import's to undo.
      if not exists (select 1 from public.scout_advancement where person_id = pid and item_id = iid) then
        insert into public.scout_advancement (org_id, person_id, item_id, status, completed_at)
        values (p_org, pid, iid, 'completed', d) returning id into aid;
        made_adv := made_adv || aid;
      else
        update public.scout_advancement set status = 'completed', completed_at = d
          where person_id = pid and item_id = iid and status <> 'completed';
      end if;
    end if;
    matched := matched + 1;
  end loop;
  insert into public.import_batches (org_id, kind, file_name, row_count, created_by, created_ids)
  values (p_org, 'advancement', p_file, matched, me, jsonb_build_object('advancement', to_jsonb(made_adv), 'progress', to_jsonb(made_prog)))
  returning id into bid;
  return jsonb_build_object('batch', bid, 'matched', matched, 'skipped', skipped);
end;
$$;

create or replace function public.import_activity(p_org uuid, p_file text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb; pid uuid; made uuid[] := '{}'; matched int := 0; skipped int := 0; nid uuid; bid uuid; k text; d date;
begin
  if not public.is_org_admin(p_org) then raise exception 'Only unit admins can import'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    k := lower(coalesce(r->>'kind', ''));
    k := case when k like 'camp%' then 'camping' when k like 'hik%' then 'hiking' when k like 'serv%' then 'service' else null end;
    pid := public.import_match_scout(p_org, r->>'member_id', r->>'first', r->>'last');
    d := (public.import_date(r->>'date', p_org) at time zone public.unit_tz(p_org))::date;
    if pid is null or k is null or coalesce(r->>'amount', '') !~ '^[0-9]+(\.[0-9]+)?$'
       or (coalesce(trim(r->>'date'), '') <> '' and d is null) then
      skipped := skipped + 1; continue;
    end if;
    insert into public.activity_log_entries (org_id, person_id, kind, amount, on_date, note)
    values (p_org, pid, k, (r->>'amount')::numeric, d, nullif(r->>'note', ''))
    returning id into nid;
    made := made || nid; matched := matched + 1;
  end loop;
  insert into public.import_batches (org_id, kind, file_name, row_count, created_ids, created_by)
  values (p_org, 'activity', p_file, matched, jsonb_build_object('activity', to_jsonb(made)), public.my_person_id())
  returning id into bid;
  return jsonb_build_object('matched', matched, 'skipped', skipped, 'batch', bid);
end;
$$;

create or replace function public.self_check_in(p_event uuid, p_code text, p_people uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare e record; pid uuid; n int := 0; added int;
begin
  select * into e from public.events where id = p_event;
  if e is null or e.checkin_code <> p_code then raise exception 'That check-in code is not valid'; end if;
  if e.canceled then raise exception 'This event was canceled'; end if;
  if now() < e.start_at - interval '2 hours' or now() > coalesce(e.end_at, e.start_at) + interval '6 hours' then
    raise exception 'Check-in is open from 2 hours before the event until it ends';
  end if;
  foreach pid in array p_people loop
    if not public.can_act_for(pid) then continue; end if;
    if not exists (select 1 from public.memberships where org_id = e.org_id and person_id = pid and status = 'active') then continue; end if;
    insert into public.attendance (org_id, event_id, person_id, present, method, confirmed, marked_by)
    values (e.org_id, p_event, pid, true, 'qr', false, public.my_person_id())
    on conflict (event_id, person_id) do nothing;
    get diagnostics added = row_count;
    n := n + added;
  end loop;
  return n;
end;
$$;

create or replace function public.create_weekly_series(p_org uuid, p_title text, p_location text, p_first timestamptz, p_minutes int, p_until date)
returns int language plpgsql security definer set search_path = public as $$
declare s uuid := uuid_generate_v4(); tz text := public.unit_tz(p_org); local_t timestamp; t timestamptz; n int := 0;
begin
  if not public.is_org_leader(p_org) then raise exception 'Not allowed'; end if;
  local_t := p_first at time zone tz;
  if p_until > (local_t::date + 400) then raise exception 'Repeat for at most about a year at a time'; end if;
  -- Step in local wall-clock time so the meeting stays at the same hour across daylight saving.
  while local_t::date <= p_until loop
    t := local_t at time zone tz;
    insert into public.events (org_id, title, location, start_at, end_at, kind, series_id, created_by)
    values (p_org, p_title, p_location, t, t + make_interval(mins => p_minutes), 'meeting', s, public.my_person_id());
    local_t := local_t + interval '7 days'; n := n + 1;
  end loop;
  return n;
end;
$$;

create or replace function public.attendance_summary(p_org uuid, p_from date, p_to date)
returns table (person_id uuid, first_name text, last_name text, type text,
               meetings_held bigint, meetings_attended bigint, outings_attended bigint,
               nights numeric, service_hours numeric, miles numeric, last_seen timestamptz)
language sql stable security definer set search_path = public as $$
  with ev as (
    select * from public.events where org_id = p_org and not canceled
      and (start_at at time zone public.unit_tz(p_org))::date between p_from and p_to and start_at < now()
  ), mem as (
    select m.person_id, p.first_name, p.last_name, p.type from public.memberships m join public.persons p on p.id = m.person_id
    where m.org_id = p_org and m.status = 'active'
  )
  select mem.person_id, mem.first_name, mem.last_name, mem.type,
    (select count(*) from ev where ev.kind = 'meeting'),
    count(e.id) filter (where e.kind = 'meeting'),
    count(e.id) filter (where e.kind <> 'meeting'),
    coalesce(sum(e.overnight_nights) filter (where e.kind <> 'service'), 0),
    coalesce(sum(e.service_hours), 0),
    coalesce(sum(e.miles), 0),
    max(e.start_at)
  from mem
  -- Unconfirmed QR self check-ins don't count until a leader confirms them.
  left join public.attendance a on a.person_id = mem.person_id and a.present and a.org_id = p_org
    and (a.confirmed or coalesce(a.method, '') <> 'qr')
  left join ev e on e.id = a.event_id
  where public.is_org_leader(p_org) or public.can_act_for(mem.person_id)
  group by mem.person_id, mem.first_name, mem.last_name, mem.type
  order by mem.type desc, mem.last_name, mem.first_name;
$$;

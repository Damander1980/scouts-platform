-- 0020: attendance depth — QR self check-in, recurring meetings, and reporting.

alter table public.events add column if not exists checkin_code text not null default substr(md5(random()::text), 1, 8);
alter table public.events add column if not exists series_id uuid;
alter table public.attendance add column if not exists method text not null default 'leader' check (method in ('leader','qr','import'));
alter table public.attendance add column if not exists confirmed boolean not null default true;

-- A family checks themselves in by scanning the event QR. Leaders see these as "self check-in"
-- and can confirm or remove them. Only works on the event day.
create or replace function public.self_check_in(p_event uuid, p_code text, p_people uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare e record; pid uuid; n int := 0;
begin
  select * into e from public.events where id = p_event;
  if e is null or e.checkin_code <> p_code then raise exception 'That check-in code is not valid'; end if;
  if now() < e.start_at - interval '2 hours' or now() > coalesce(e.end_at, e.start_at) + interval '6 hours' then
    raise exception 'Check-in is open from 2 hours before the event until it ends';
  end if;
  foreach pid in array p_people loop
    if not public.can_act_for(pid) then continue; end if;
    if not exists (select 1 from public.memberships where org_id = e.org_id and person_id = pid and status = 'active') then continue; end if;
    insert into public.attendance (org_id, event_id, person_id, present, method, confirmed, marked_by)
    values (e.org_id, p_event, pid, true, 'qr', false, public.my_person_id())
    on conflict (event_id, person_id) do nothing;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Leaders create a repeating weekly meeting in one step.
create or replace function public.create_weekly_series(p_org uuid, p_title text, p_location text, p_first timestamptz, p_minutes int, p_until date)
returns int language plpgsql security definer set search_path = public as $$
declare s uuid := uuid_generate_v4(); t timestamptz := p_first; n int := 0;
begin
  if not public.is_org_leader(p_org) then raise exception 'Not allowed'; end if;
  if p_until > (p_first::date + 400) then raise exception 'Repeat for at most about a year at a time'; end if;
  while t::date <= p_until loop
    insert into public.events (org_id, title, location, start_at, end_at, kind, series_id, created_by)
    values (p_org, p_title, p_location, t, t + make_interval(mins => p_minutes), 'meeting', s, public.my_person_id());
    t := t + interval '7 days'; n := n + 1;
  end loop;
  return n;
end;
$$;

-- Per-Scout attendance summary for a date range (meetings vs. outings, credits).
create or replace function public.attendance_summary(p_org uuid, p_from date, p_to date)
returns table (person_id uuid, first_name text, last_name text, type text,
               meetings_held bigint, meetings_attended bigint, outings_attended bigint,
               nights numeric, service_hours numeric, miles numeric, last_seen timestamptz)
language sql stable security definer as $$
  with ev as (
    select * from public.events where org_id = p_org and not canceled and start_at::date between p_from and p_to and start_at < now()
  ), mem as (
    select m.person_id, p.first_name, p.last_name, p.type from public.memberships m join public.persons p on p.id = m.person_id
    where m.org_id = p_org and m.status = 'active'
  )
  select mem.person_id, mem.first_name, mem.last_name, mem.type,
    (select count(*) from ev where ev.kind = 'meeting'),
    count(a.id) filter (where e.kind = 'meeting'),
    count(a.id) filter (where e.kind <> 'meeting'),
    coalesce(sum(e.overnight_nights) filter (where e.kind <> 'service'), 0),
    coalesce(sum(e.service_hours), 0),
    coalesce(sum(e.miles), 0),
    max(e.start_at)
  from mem
  left join public.attendance a on a.person_id = mem.person_id and a.present and a.org_id = p_org
  left join ev e on e.id = a.event_id
  where public.is_org_leader(p_org) or public.can_act_for(mem.person_id)
  group by mem.person_id, mem.first_name, mem.last_name, mem.type
  order by mem.type desc, mem.last_name, mem.first_name;
$$;

-- A finished event is closed to families: no new sign-ups (which charged them) and no cancel-for-refund
-- after the fact. Leaders can still fix anything.
create or replace function public.set_rsvp(
  p_event uuid, p_person uuid, p_status text, p_notes text, p_driver_seats int, p_dietary text, p_answers jsonb
) returns text language plpgsql security definer set search_path = public as $$
declare
  e record; prev record; hid uuid; final_status text; going_count int; me uuid;
  charged int; credited int; refund int; pay_org uuid; label text;
  scout_self boolean; mode text; needs_ok boolean := false; owe_limit int; owed int; fam uuid;
begin
  me := public.my_person_id();
  -- Locks the event row: sign-ups for one event are handled one at a time, so the cap holds.
  select * into e from public.events where id = p_event for update;
  if e is null or e.canceled then raise exception 'This event is not open'; end if;
  pay_org := public.rsvp_unit(p_event, p_person);
  if pay_org is null then raise exception 'That person is not a member of this unit or a linked unit'; end if;
  if not (public.can_act_for(p_person) or public.is_org_leader(e.org_id) or public.is_org_leader(pay_org)) then raise exception 'Not allowed'; end if;
  if p_status not in ('going','not_going') then raise exception 'Bad status'; end if;
  select * into prev from public.rsvps where event_id = p_event and person_id = p_person;
  -- A sign-up still waiting for a parent's OK was never charged, so a parent can still decline it afterwards
  -- (otherwise it would sit "waiting for approval" forever).
  if now() > coalesce(e.end_at, e.start_at) and not (public.is_org_leader(e.org_id) or public.is_org_leader(pay_org))
     and not (p_status = 'not_going' and coalesce(prev.rsvp_approval_status, '') = 'pending') then
    raise exception 'This event is over. Ask a leader if something needs to change.';
  end if;
  -- The deadline closes NEW sign-ups only. Families can still cancel (the refund rule decides any
  -- credit), edit notes, and a parent can still approve a Scout's sign-up made before the deadline.
  if e.rsvp_deadline is not null and now() > e.rsvp_deadline and p_status = 'going'
     and coalesce(prev.status, '') not in ('going', 'waitlisted') and not public.is_org_leader(e.org_id) then
    raise exception 'The sign-up deadline has passed. Ask a leader to add you.';
  end if;
  -- Unit setting "When a Scout with a login RSVPs" (SPEC: Scouts do it themselves; parents keep the
  -- final say on money). Default: a Scout's paid sign-up waits for a parent's OK before any charge.
  scout_self := coalesce(me = p_person, false) and exists (select 1 from public.persons where id = me and type = 'youth');
  mode := coalesce((select settings->>'scout_rsvp' from public.organizations where id = pay_org), 'parent_approves_paid');
  if scout_self and mode = 'parent_only' then
    raise exception 'Your troop asks a parent to sign you up. Ask a parent to do it from their account.';
  end if;

  label := e.title || case when pay_org <> e.org_id
    then ' (hosted by ' || (select name from public.organizations where id = e.org_id) || ')' else '' end;

  -- Unit setting: block new sign-ups for families who owe more than a set amount (leaders can still add anyone).
  owe_limit := nullif(coalesce((select settings->>'block_owing_cents' from public.organizations where id = pay_org), ''), '')::int;
  if owe_limit is not null and p_status = 'going' and coalesce(prev.status, '') not in ('going', 'waitlisted')
     and not (public.is_org_leader(e.org_id) or public.is_org_leader(pay_org)) then
    fam := coalesce(public.person_household_in(p_person, pay_org), public.person_household(p_person));
    select coalesce(sum(amount_cents), 0) into owed from public.ledger_entries where household_id = fam and org_id = pay_org;
    if owed > owe_limit then
      raise exception 'Your family owes $% to the unit. Please pay before signing up for new events.', to_char(owed / 100.0, 'FM999999990.00');
    end if;
  end if;

  final_status := p_status;
  -- Already waitlisted stays in line (promotion below fills open spots in sign-up order).
  if p_status = 'going' and prev.status = 'waitlisted' then
    final_status := 'waitlisted';
  elsif p_status = 'going' and coalesce(prev.status, '') <> 'going' and e.cap is not null then
    select count(*) into going_count from public.rsvps where event_id = p_event and status = 'going';
    if going_count >= e.cap then final_status := 'waitlisted'; end if;
  end if;

  -- A parent's earlier OK counts only for the sign-up it was given for, not after a cancel.
  needs_ok := coalesce(scout_self and mode = 'parent_approves_paid' and e.cost_cents > 0 and final_status in ('going', 'waitlisted')
    and not (prev.rsvp_approval_status = 'approved' and prev.status in ('going', 'waitlisted')), false)
    -- A Scout's sign-up waiting for a parent stays waiting when a leader edits it (only a parent approves money).
    or coalesce(final_status in ('going', 'waitlisted') and prev.rsvp_approval_status = 'pending' and e.cost_cents > 0
       and not public.is_guardian_of(p_person), false);

  insert into public.rsvps (event_id, person_id, status, notes, driver_seats, dietary, answers, updated_by, updated_at, rsvp_approval_status)
  values (p_event, p_person, final_status, p_notes, coalesce(p_driver_seats, 0), p_dietary, coalesce(p_answers, '{}'), me, now(),
          case when needs_ok then 'pending' when final_status = 'not_going' and prev.rsvp_approval_status = 'denied' then 'denied' else 'approved' end)
  on conflict (event_id, person_id) do update set status = excluded.status, notes = excluded.notes,
    driver_seats = excluded.driver_seats, dietary = excluded.dietary, answers = excluded.answers,
    updated_by = me, updated_at = now(), rsvp_approval_status = excluded.rsvp_approval_status,
    -- Signing up again after canceling goes to the back of the line.
    rsvp_at = case when rsvps.status not in ('going', 'waitlisted') and excluded.status in ('going', 'waitlisted') then now() else rsvps.rsvp_at end;

  hid := coalesce(public.person_household_in(p_person, pay_org), public.person_household(p_person));
  -- Nothing is charged while a parent's OK is pending.
  if hid is not null and e.cost_cents > 0 and not needs_ok then
    select coalesce(sum(amount_cents) filter (where type = 'charge'), 0),
           coalesce(-sum(amount_cents) filter (where type = 'credit'), 0)
      into charged, credited
    from public.ledger_entries
    where event_id = p_event and household_id = hid and person_id = p_person;

    -- Charge up to the event cost (after a partial credit, signing up again charges only the difference).
    if final_status = 'going' and charged - credited < e.cost_cents then
      insert into public.ledger_entries (org_id, household_id, amount_cents, type, description, event_id, created_by, person_id)
      values (pay_org, hid, e.cost_cents - (charged - credited), 'charge', label, p_event, me, p_person);
    elsif final_status <> 'going' and charged - credited > 0 then
      refund := case e.refund_rule when 'full' then charged - credited
                                   when 'partial' then (charged - credited) / 2 else 0 end;
      if now() < coalesce(e.rsvp_deadline, e.start_at) then refund := charged - credited; end if;
      if refund > 0 then
        insert into public.ledger_entries (org_id, household_id, amount_cents, type, description, event_id, created_by, person_id)
        values (pay_org, hid, -refund, 'credit', 'Canceled: ' || label, p_event, me, p_person);
      end if;
    end if;
  end if;

  -- Fill any open spots from the waitlist, charged through each person's own unit.
  -- Not once the event is over: nobody is moved off the waitlist (and charged) after the fact.
  if now() <= coalesce(e.end_at, e.start_at) then perform public.rsvp_promote(p_event, me); end if;
  select status into final_status from public.rsvps where event_id = p_event and person_id = p_person;

  insert into public.audit_log (org_id, actor_id, action, target_type, target_id, payload)
  values (e.org_id, me, 'rsvp.set', 'event', p_event, jsonb_build_object('person', p_person, 'from', prev.status, 'to', final_status, 'via_unit', pay_org));
  return final_status;
end;
$$;

-- A weekly series kept only the title and place; everything else the leader filled in (description,
-- who can see it, cost, cap, permission slip, service hours) was dropped. The rest now comes along.
-- The old six-argument version is dropped so a stale caller can't still create series without the extras.
drop function if exists public.create_weekly_series(uuid, text, text, timestamptz, int, date);
create or replace function public.create_weekly_series(p_org uuid, p_title text, p_location text, p_first timestamptz, p_minutes int, p_until date, p_extra jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare s uuid := gen_random_uuid(); tz text := public.unit_tz(p_org); local_t timestamp; t timestamptz; n int := 0;
begin
  if not public.is_org_leader(p_org) then raise exception 'Not allowed'; end if;
  local_t := p_first at time zone tz;
  if p_until > (local_t::date + 400) then raise exception 'Repeat for at most about a year at a time'; end if;
  while local_t::date <= p_until loop
    t := local_t at time zone tz;
    insert into public.events (org_id, title, location, start_at, end_at, kind, series_id, created_by,
      description, visibility, needs_permission, share_linked, service_hours, miles, questions, cost_cents, cap, refund_rule)
    values (p_org, p_title, p_location, t, t + make_interval(mins => p_minutes), 'meeting', s, public.my_person_id(),
      nullif(p_extra->>'description', ''),
      coalesce(nullif(p_extra->>'visibility', ''), 'members'),
      coalesce((p_extra->>'needs_permission')::boolean, false),
      coalesce((p_extra->>'share_linked')::boolean, false),
      coalesce((p_extra->>'service_hours')::numeric, 0),
      coalesce((p_extra->>'miles')::numeric, 0),
      coalesce(p_extra->'questions', '[]'::jsonb),
      coalesce((p_extra->>'cost_cents')::int, 0),
      nullif(p_extra->>'cap', '')::int,
      coalesce(nullif(p_extra->>'refund_rule', ''), 'none'));
    local_t := local_t + interval '7 days'; n := n + 1;
  end loop;
  return n;
end;
$$;

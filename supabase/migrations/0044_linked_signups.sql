-- Also: the unit's "When a Scout with a login RSVPs" setting is now enforced (see set_rsvp).
-- Linked units, phase 2: combined sign-ups (Floyd, 2026-10-21: "every payer is an individual
-- account; parents can pay for their kids, including on linked-unit events").
-- A member of a linked unit can sign up for a shared event. The charge goes on that person's
-- family account in their OWN unit, labeled with the host unit; the two units' treasurers
-- settle between themselves. Host leaders see linked guests on the event roster.

-- The family a person belongs to inside one unit.
create or replace function public.person_household_in(pid uuid, org uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select hm.household_id from public.household_members hm
  join public.households h on h.id = hm.household_id
  where hm.person_id = pid and h.org_id = org
  order by hm.is_guardian desc limit 1;
$$;

-- The unit a person signs up through: the host unit if they belong to it, otherwise a unit with
-- an accepted link to the host when the event is shared with linked units. Null = not allowed.
create or replace function public.rsvp_unit(p_event uuid, p_person uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.memberships m where m.org_id = e.org_id and m.person_id = p_person and m.status = 'active') then e.org_id
    when e.share_linked then (
      select m.org_id from public.memberships m
      join public.unit_links l on l.status = 'accepted'
        and ((l.requester_org = e.org_id and l.target_org = m.org_id) or (l.target_org = e.org_id and l.requester_org = m.org_id))
      where m.person_id = p_person and m.status = 'active'
      order by m.org_id limit 1)
  end
  from public.events e where e.id = p_event;
$$;

create or replace function public.set_rsvp(
  p_event uuid, p_person uuid, p_status text, p_notes text, p_driver_seats int, p_dietary text, p_answers jsonb
) returns text language plpgsql security definer set search_path = public as $$
declare
  e record; prev record; hid uuid; final_status text; going_count int; me uuid;
  charged int; credited int; refund int; nxt record; pay_org uuid; nxt_org uuid; label text;
  scout_self boolean; mode text; needs_ok boolean := false; owe_limit int; owed int; fam uuid;
begin
  me := public.my_person_id();
  select * into e from public.events where id = p_event;
  if e is null or e.canceled then raise exception 'This event is not open'; end if;
  pay_org := public.rsvp_unit(p_event, p_person);
  if pay_org is null then raise exception 'That person is not a member of this unit or a linked unit'; end if;
  if not (public.can_act_for(p_person) or public.is_org_leader(e.org_id) or public.is_org_leader(pay_org)) then raise exception 'Not allowed'; end if;
  if p_status not in ('going','not_going') then raise exception 'Bad status'; end if;
  select * into prev from public.rsvps where event_id = p_event and person_id = p_person;
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
  if owe_limit is not null and p_status = 'going' and coalesce(prev.status, '') <> 'going'
     and not (public.is_org_leader(e.org_id) or public.is_org_leader(pay_org)) then
    fam := coalesce(public.person_household_in(p_person, pay_org), public.person_household(p_person));
    select coalesce(sum(amount_cents), 0) into owed from public.ledger_entries where household_id = fam and org_id = pay_org;
    if owed > owe_limit then
      raise exception 'Your family owes $% to the unit. Please pay before signing up for new events.', to_char(owed / 100.0, 'FM999999990.00');
    end if;
  end if;

  final_status := p_status;
  if p_status = 'going' and coalesce(prev.status, '') not in ('going') and e.cap is not null then
    select count(*) into going_count from public.rsvps where event_id = p_event and status = 'going';
    if going_count >= e.cap then final_status := 'waitlisted'; end if;
  end if;
  if p_status = 'going' and prev.status = 'waitlisted' then final_status := 'waitlisted'; end if;

  needs_ok := coalesce(scout_self and mode = 'parent_approves_paid' and e.cost_cents > 0 and final_status = 'going'
    and coalesce(prev.rsvp_approval_status, 'pending') <> 'approved', false);

  insert into public.rsvps (event_id, person_id, status, notes, driver_seats, dietary, answers, updated_by, updated_at, rsvp_approval_status)
  values (p_event, p_person, final_status, p_notes, coalesce(p_driver_seats, 0), p_dietary, coalesce(p_answers, '{}'), me, now(),
          case when needs_ok then 'pending' else 'approved' end)
  on conflict (event_id, person_id) do update set status = excluded.status, notes = excluded.notes,
    driver_seats = excluded.driver_seats, dietary = excluded.dietary, answers = excluded.answers,
    updated_by = me, updated_at = now(), rsvp_approval_status = excluded.rsvp_approval_status;

  hid := coalesce(public.person_household_in(p_person, pay_org), public.person_household(p_person));
  -- Nothing is charged while a parent's OK is pending.
  if hid is not null and e.cost_cents > 0 and not needs_ok then
    select coalesce(sum(amount_cents) filter (where type = 'charge'), 0),
           coalesce(-sum(amount_cents) filter (where type in ('credit','refund')), 0)
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

  -- Someone dropped: move the first waitlisted person up, charged through their own unit.
  if prev.status = 'going' and final_status <> 'going' then
    select * into nxt from public.rsvps where event_id = p_event and status = 'waitlisted' order by rsvp_at limit 1;
    if found then
      update public.rsvps set status = 'going', updated_at = now() where id = nxt.id;
      nxt_org := coalesce(public.rsvp_unit(p_event, nxt.person_id), e.org_id);
      hid := coalesce(public.person_household_in(nxt.person_id, nxt_org), public.person_household(nxt.person_id));
      if hid is not null and e.cost_cents > 0 then
        insert into public.ledger_entries (org_id, household_id, amount_cents, type, description, event_id, created_by, person_id)
        values (nxt_org, hid, e.cost_cents, 'charge',
          e.title || case when nxt_org <> e.org_id then ' (hosted by ' || (select name from public.organizations where id = e.org_id) || ')' else '' end
          || ' (off waitlist)', p_event, me, nxt.person_id);
      end if;
    end if;
  end if;

  insert into public.audit_log (org_id, actor_id, action, target_type, target_id, payload)
  values (e.org_id, me, 'rsvp.set', 'event', p_event, jsonb_build_object('person', p_person, 'from', prev.status, 'to', final_status, 'via_unit', pay_org));
  return final_status;
end;
$$;

-- Guests from linked units on a host event, for the host unit's leaders.
create or replace function public.event_guests(p_event uuid)
returns table (person_id uuid, first_name text, last_name text, type text, unit_name text, status text, driver_seats int, dietary text)
language sql stable security definer set search_path = public as $$
  select r.person_id, p.first_name, p.last_name, p.type, o.name, r.status, r.driver_seats, r.dietary
  from public.events e
  join public.rsvps r on r.event_id = e.id
  join public.persons p on p.id = r.person_id
  join public.organizations o on o.id = public.rsvp_unit(e.id, r.person_id)
  where e.id = p_event and public.is_org_leader(e.org_id)
    and not exists (select 1 from public.memberships m where m.org_id = e.org_id and m.person_id = r.person_id and m.status = 'active');
$$;

-- A parent approves (charges the family) or declines a Scout's paid sign-up.
create or replace function public.decide_scout_rsvp(p_event uuid, p_person uuid, p_approve boolean)
returns text language plpgsql security definer set search_path = public as $$
declare r record; me uuid;
begin
  me := public.my_person_id();
  if not public.can_act_for(p_person) or exists (select 1 from public.persons where id = me and type = 'youth') then
    raise exception 'Only a parent or guardian can approve this';
  end if;
  select * into r from public.rsvps where event_id = p_event and person_id = p_person;
  if r is null or r.rsvp_approval_status <> 'pending' then raise exception 'Nothing is waiting for approval'; end if;
  if p_approve then
    update public.rsvps set rsvp_approval_status = 'approved' where id = r.id;
    -- Re-run as the parent: the sign-up stands and the charge posts to the family.
    return public.set_rsvp(p_event, p_person, 'going', r.notes, r.driver_seats, r.dietary, r.answers);
  end if;
  update public.rsvps set rsvp_approval_status = 'denied' where id = r.id;
  return public.set_rsvp(p_event, p_person, 'not_going', r.notes, r.driver_seats, r.dietary, r.answers);
end;
$$;

grant execute on function public.decide_scout_rsvp(uuid, uuid, boolean) to authenticated;
grant execute on function public.person_household_in(uuid, uuid) to authenticated;
grant execute on function public.rsvp_unit(uuid, uuid) to authenticated;
grant execute on function public.event_guests(uuid) to authenticated;

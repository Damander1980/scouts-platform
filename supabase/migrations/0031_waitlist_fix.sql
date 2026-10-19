-- 0031a: waitlist promotion used 'record is not null', which is false whenever any column is null.

create or replace function public.set_rsvp(
  p_event uuid, p_person uuid, p_status text, p_notes text, p_driver_seats int, p_dietary text, p_answers jsonb
) returns text language plpgsql security definer set search_path = public as $$
declare
  e record; prev record; hid uuid; final_status text; going_count int; me uuid;
  charged int; credited int; refund int; nxt record;
begin
  me := public.my_person_id();
  select * into e from public.events where id = p_event;
  if e is null or e.canceled then raise exception 'This event is not open'; end if;
  if not (public.can_act_for(p_person) or public.is_org_leader(e.org_id)) then raise exception 'Not allowed'; end if;
  if not exists (select 1 from public.memberships where org_id = e.org_id and person_id = p_person and status = 'active') then
    raise exception 'That person is not a member of this unit';
  end if;
  if p_status not in ('going','not_going') then raise exception 'Bad status'; end if;
  if e.rsvp_deadline is not null and now() > e.rsvp_deadline and not public.is_org_leader(e.org_id) then
    raise exception 'The sign-up deadline has passed. Ask a leader to add you.';
  end if;

  select * into prev from public.rsvps where event_id = p_event and person_id = p_person;
  final_status := p_status;
  if p_status = 'going' and coalesce(prev.status, '') not in ('going') and e.cap is not null then
    select count(*) into going_count from public.rsvps where event_id = p_event and status = 'going';
    if going_count >= e.cap then final_status := 'waitlisted'; end if;
  end if;
  if p_status = 'going' and prev.status = 'waitlisted' then final_status := 'waitlisted'; end if;

  insert into public.rsvps (event_id, person_id, status, notes, driver_seats, dietary, answers, updated_by, updated_at)
  values (p_event, p_person, final_status, p_notes, coalesce(p_driver_seats, 0), p_dietary, coalesce(p_answers, '{}'), me, now())
  on conflict (event_id, person_id) do update set status = excluded.status, notes = excluded.notes,
    driver_seats = excluded.driver_seats, dietary = excluded.dietary, answers = excluded.answers,
    updated_by = me, updated_at = now();

  hid := public.person_household(p_person);
  if hid is not null and e.cost_cents > 0 then
    select coalesce(sum(amount_cents) filter (where type = 'charge'), 0),
           coalesce(-sum(amount_cents) filter (where type in ('credit','refund')), 0)
      into charged, credited
    from public.ledger_entries
    where event_id = p_event and household_id = hid and person_id = p_person;

    if final_status = 'going' and charged - credited <= 0 then
      insert into public.ledger_entries (org_id, household_id, amount_cents, type, description, event_id, created_by, person_id)
      values (e.org_id, hid, e.cost_cents, 'charge', e.title, p_event, me, p_person);
    elsif final_status <> 'going' and charged - credited > 0 then
      refund := case e.refund_rule when 'full' then charged - credited
                                   when 'partial' then (charged - credited) / 2 else 0 end;
      if now() < coalesce(e.rsvp_deadline, e.start_at) then refund := charged - credited; end if;
      if refund > 0 then
        insert into public.ledger_entries (org_id, household_id, amount_cents, type, description, event_id, created_by, person_id)
        values (e.org_id, hid, -refund, 'credit', 'Canceled: ' || e.title, p_event, me, p_person);
      end if;
    end if;
  end if;

  -- Someone dropped: move the first waitlisted person up.
  if prev.status = 'going' and final_status <> 'going' then
    select * into nxt from public.rsvps where event_id = p_event and status = 'waitlisted' order by rsvp_at limit 1;
    if found then
      update public.rsvps set status = 'going', updated_at = now() where id = nxt.id;
      hid := public.person_household(nxt.person_id);
      if hid is not null and e.cost_cents > 0 then
        insert into public.ledger_entries (org_id, household_id, amount_cents, type, description, event_id, created_by, person_id)
        values (e.org_id, hid, e.cost_cents, 'charge', e.title || ' (off waitlist)', p_event, me, nxt.person_id);
      end if;
    end if;
  end if;

  insert into public.audit_log (org_id, actor_id, action, target_type, target_id, payload)
  values (e.org_id, me, 'rsvp.set', 'event', p_event, jsonb_build_object('person', p_person, 'from', prev.status, 'to', final_status));
  return final_status;
end;
$$;


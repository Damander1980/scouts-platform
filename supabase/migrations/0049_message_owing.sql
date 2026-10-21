-- Treasurer tool: message the parents and guardians of every family with a balance due.
-- Same send_message as 0011 plus the 'owing' audience, allowed for leaders and money roles.

create or replace function public.send_message(
  p_org uuid, p_subject text, p_body text, p_audience text, p_ref uuid, p_person_ids uuid[]
) returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid; mid uuid; leader boolean; pl boolean; root uuid;
begin
  me := public.my_person_id();
  if me is null or not public.is_org_member(p_org) then raise exception 'Not allowed'; end if;
  if coalesce(trim(p_body), '') = '' then raise exception 'Write a message first'; end if;
  leader := public.is_org_leader(p_org);
  pl := exists (select 1 from public.patrol_members pm where pm.person_id = me and pm.end_date is null
                and pm.role in ('patrol_leader','assistant_patrol_leader') and pm.org_id = p_org);

  if p_audience in ('troop','nonresponders','event','people') and not leader then
    raise exception 'Only leaders can send to that group. You can message your leaders or reply to a message.';
  end if;
  if p_audience = 'owing' and not (leader or public.has_perm(p_org, 'money.manage')) then
    raise exception 'Only leaders or the treasurer can message families who owe';
  end if;
  if p_audience = 'patrol' and not (leader or (pl and exists (select 1 from public.patrol_members
      where person_id = me and patrol_id = p_ref and end_date is null))) then
    raise exception 'Only leaders or that patrol''s leaders can message a patrol';
  end if;
  if p_audience = 'reply' then
    if not exists (select 1 from public.message_recipients where message_id = p_ref and person_id = me) then
      raise exception 'You can only reply to messages you received';
    end if;
    select coalesce(parent_id, id) into root from public.message_log where id = p_ref;
  end if;

  insert into public.message_log (org_id, sender_id, subject, body, channel, audience, audience_ref, event_id, parent_id)
  values (p_org, me, nullif(trim(p_subject), ''), p_body, 'in_app', p_audience, p_ref,
          case when p_audience in ('event','nonresponders') then p_ref end, root)
  returning id into mid;

  create temp table if not exists _rcpt (person_id uuid, reason text) on commit drop;
  delete from _rcpt;

  if p_audience = 'troop' then
    insert into _rcpt select m.person_id, 'direct' from public.memberships m where m.org_id = p_org and m.status = 'active';
  elsif p_audience = 'patrol' then
    insert into _rcpt select pm.person_id, 'direct' from public.patrol_members pm where pm.patrol_id = p_ref and pm.end_date is null;
  elsif p_audience = 'event' then
    insert into _rcpt select r.person_id, 'direct' from public.rsvps r where r.event_id = p_ref and r.status in ('going','waitlisted');
  elsif p_audience = 'nonresponders' then
    insert into _rcpt select m.person_id, 'direct' from public.memberships m
      where m.org_id = p_org and m.status = 'active'
        and not exists (select 1 from public.rsvps r where r.event_id = p_ref and r.person_id = m.person_id);
  elsif p_audience = 'owing' then
    -- Parents and guardians of families with a balance due (never the Scouts themselves).
    insert into _rcpt select hm.person_id, 'direct'
      from public.households h
      join public.household_members hm on hm.household_id = h.id and hm.is_guardian
      where h.org_id = p_org
        and (select coalesce(sum(l.amount_cents), 0) from public.ledger_entries l where l.household_id = h.id and l.org_id = p_org) > 0
        and exists (select 1 from public.memberships m where m.org_id = p_org and m.person_id = hm.person_id and m.status = 'active');
  elsif p_audience = 'people' then
    insert into _rcpt select unnest(p_person_ids), 'direct';
  elsif p_audience = 'leaders' then
    insert into _rcpt select m.person_id, 'direct' from public.memberships m
      where m.org_id = p_org and m.status = 'active' and (m.is_designated_leader or m.is_admin);
  elsif p_audience = 'reply' then
    insert into _rcpt select r.person_id, coalesce(nullif(r.copy_reason, 'sender'), 'direct')
      from public.message_recipients r where r.message_id = p_ref;
  else
    raise exception 'Unknown audience';
  end if;

  insert into _rcpt select g.person_id, 'parent_copy'
  from _rcpt r join public.persons p on p.id = r.person_id and p.type = 'youth'
  join public.household_members kid on kid.person_id = r.person_id
  join public.household_members g on g.household_id = kid.household_id and g.is_guardian;

  if exists (select 1 from public.persons where id = me and type = 'youth') then
    insert into _rcpt select g.person_id, 'parent_copy' from public.household_members kid
      join public.household_members g on g.household_id = kid.household_id and g.is_guardian
      where kid.person_id = me;
  end if;

  if exists (select 1 from _rcpt r join public.persons p on p.id = r.person_id where p.type = 'youth')
     or exists (select 1 from public.persons where id = me and type = 'youth') then
    insert into _rcpt select m.person_id, 'leader_copy' from public.memberships m
      where m.org_id = p_org and m.status = 'active' and m.is_designated_leader;
  end if;

  insert into public.message_recipients (message_id, person_id, copy_reason)
  select mid, person_id,
    case when bool_or(reason = 'direct') then 'direct' when bool_or(reason = 'parent_copy') then 'parent_copy' else 'leader_copy' end
  from _rcpt where person_id <> me group by person_id
  on conflict do nothing;
  insert into public.message_recipients (message_id, person_id, copy_reason, read_at)
  values (mid, me, 'sender', now()) on conflict do nothing;
  return mid;
end;
$$;


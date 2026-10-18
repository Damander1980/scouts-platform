-- 0011: replies (same group, never private), messages to leaders, admin view logging.

alter table public.message_log add column if not exists parent_id uuid references public.message_log(id) on delete set null;

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

-- Admins reading the full log leave a record.
create or replace function public.log_message_view(p_org uuid)
returns void language sql security definer as $$
  insert into public.message_log_views (org_id, viewer_id) select p_org, public.my_person_id()
  where public.is_org_admin(p_org);
$$;

-- Names of message participants are visible to recipients even across households.
create or replace function public.person_names(p_ids uuid[])
returns table (id uuid, first_name text, last_name text, type text)
language sql stable security definer as $$
  select p.id, p.first_name, p.last_name, p.type from public.persons p
  where p.id = any(p_ids)
    and exists (select 1 from public.memberships m1 join public.memberships m2 on m1.org_id = m2.org_id
                where m1.person_id = p.id and m2.person_id = public.my_person_id() and m2.status = 'active');
$$;

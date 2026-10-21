-- Safety first (Floyd, 2026-10-21): unit admins no longer skip the Youth Protection check.
-- Private member details, health form status and the message log now need current YPT for
-- everyone, admins and designated leaders included. Admins keep every other tool, including
-- recording YPT dates on the Members page, so a new unit can still get set up.

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
      and (not coalesce(c.needs_ypt, false) or m.ypt_expires >= current_date)
  );
$$;

-- What this person would have with current YPT. Admins hold every permission, so for them it
-- is every YPT-gated permission.
create or replace function public.my_ypt_blocked(p_org uuid)
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct c.key), '{}')
  from public.memberships m
  join public.persons p on p.id = m.person_id and p.user_id = auth.uid() and p.type = 'adult'
  join public.permission_catalog c on c.needs_ypt
  where m.org_id = p_org and m.status = 'active'
    and (m.ypt_expires is null or m.ypt_expires < current_date)
    and (m.is_admin or exists (
      select 1 from public.position_holders h join public.unit_positions u on u.id = h.position_id
      where h.org_id = m.org_id and h.person_id = m.person_id and c.key = any(u.permissions)));
$$;

-- True when the signed-in person has current YPT in this unit.
create or replace function public.my_ypt_current(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m join public.persons p on p.id = m.person_id
    where m.org_id = org and p.user_id = auth.uid() and m.status = 'active' and m.ypt_expires >= current_date);
$$;
grant execute on function public.my_ypt_current(uuid) to authenticated;

-- Message log: admins and designated leaders need current YPT to read other people's messages.
-- Senders and recipients always see their own.
drop policy if exists "messages: recipients and admins view" on public.message_log;
create policy "messages: recipients and admins view" on public.message_log for select using (
  (public.is_org_admin(org_id) and public.my_ypt_current(org_id))
  or public.has_perm(org_id, 'messages.audit')
  or (public.my_ypt_current(org_id) and exists (select 1 from public.memberships m
        where m.org_id = message_log.org_id and m.is_designated_leader and public.is_own_person(m.person_id)))
  or public.is_own_person(sender_id)
  or public.is_message_recipient(id));
drop policy if exists "msg_recipients: own view" on public.message_recipients;
create policy "msg_recipients: own view" on public.message_recipients for select using (
  public.is_own_person(person_id)
  or (public.is_org_admin(public.message_org(message_id)) and public.my_ypt_current(public.message_org(message_id)))
  or public.has_perm(public.message_org(message_id), 'messages.audit'));
drop policy if exists "log_views: admins view" on public.message_log_views;
create policy "log_views: admins view" on public.message_log_views for select
  using ((public.is_org_admin(org_id) and public.my_ypt_current(org_id)) or public.has_perm(org_id, 'messages.audit'));

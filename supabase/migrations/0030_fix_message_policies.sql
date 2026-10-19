-- 0030: message_log and message_recipients policies referenced each other (infinite recursion).

create or replace function public.is_message_recipient(mid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.message_recipients r join public.persons p on p.id = r.person_id
                 where r.message_id = mid and p.user_id = auth.uid());
$$;

create or replace function public.message_org(mid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from public.message_log where id = mid;
$$;

drop policy if exists "messages: recipients and admins view" on public.message_log;
create policy "messages: recipients and admins view" on public.message_log for select using (
  public.is_org_admin(org_id)
  or exists (select 1 from public.memberships m where m.org_id = message_log.org_id and m.is_designated_leader and public.is_own_person(m.person_id))
  or public.is_own_person(sender_id)
  or public.is_message_recipient(id));

drop policy if exists "msg_recipients: own view" on public.message_recipients;
create policy "msg_recipients: own view" on public.message_recipients for select using (
  public.is_own_person(person_id) or public.is_org_admin(public.message_org(message_id)));

drop policy if exists "deliveries: sender or admins view" on public.message_deliveries;
create policy "deliveries: sender or admins view" on public.message_deliveries for select using (
  public.is_org_admin(public.message_org(message_id))
  or exists (select 1 from public.message_log m where m.id = message_id and public.is_own_person(m.sender_id)));

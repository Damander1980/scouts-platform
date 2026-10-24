-- Addresses that bounced for good or reported us as spam. Filled by the email provider's webhook (service role
-- only: no policies), read by leaders only as "which people are affected", never the raw address list.
create table if not exists public.email_suppressions (
  email      text primary key check (email = lower(email)),
  reason     text not null check (reason in ('bounce', 'complaint')),
  detail     text,
  created_at timestamptz not null default now()
);
alter table public.email_suppressions enable row level security;

-- The address we actually mail: the contact email a leader set, else the login email (same order as lib/messageEmail.ts).
create or replace function public.person_mail_address(p_person uuid)
returns text language sql stable security definer set search_path = public as $$
  select lower(coalesce(nullif(trim(p.email), ''), u.email))
  from public.persons p left join public.users u on u.id = p.user_id where p.id = p_person;
$$;
revoke execute on function public.person_mail_address(uuid) from public, anon, authenticated;

-- Active members of a unit whose address is on hold, with why. Names only; leaders with private-detail access.
create or replace function public.unit_suppressed_people(p_org uuid)
returns table (person_id uuid, reason text, since timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_perm(p_org, 'members.private') then raise exception 'Not allowed'; end if;
  return query
  select m.person_id, s.reason, s.created_at
  from public.memberships m
  join public.email_suppressions s on s.email = public.person_mail_address(m.person_id)
  where m.org_id = p_org and m.status = 'active';
end;
$$;
grant execute on function public.unit_suppressed_people(uuid) to authenticated;

-- A leader can lift a hold after the person fixed their inbox (not for spam complaints: they asked us to stop).
create or replace function public.clear_email_suppression(p_org uuid, p_person uuid)
returns void language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_org_admin(p_org) then raise exception 'Only unit admins can do that'; end if;
  if not public.person_in_org(p_person, p_org) then raise exception 'That person is not in this unit'; end if;
  delete from public.email_suppressions where email = public.person_mail_address(p_person) and reason = 'bounce';
  get diagnostics n = row_count;
  -- Nothing lifted (no hold, or a spam complaint): say so instead of logging a clear that didn't happen.
  if n = 0 then raise exception 'There is no bounce hold to clear for this person'; end if;
  insert into public.audit_log (org_id, actor_id, action, target_type, target_id)
    values (p_org, public.my_person_id(), 'email.hold_cleared', 'person', p_person);
end;
$$;
grant execute on function public.clear_email_suppression(uuid, uuid) to authenticated;

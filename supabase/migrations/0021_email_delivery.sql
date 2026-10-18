-- 0021: email delivery for unit messages (like TroopWebHost's TroopMail).

alter table public.persons add column if not exists email text;
alter table public.persons add column if not exists phone text;
alter table public.message_log add column if not exists delivery jsonb;

-- Leaders keep contact emails current for members who don't have a login yet.
create policy "persons: admins update contact" on public.persons for update using (
  exists (select 1 from public.memberships m where m.person_id = persons.id and public.is_org_admin(m.org_id)));

-- Roster import also accepts an email column; adults get it as their contact email.
create or replace function public.set_contact_email(p_org uuid, p_person uuid, p_email text)
returns void language plpgsql security definer as $$
begin
  if not (public.is_org_admin(p_org) or public.can_act_for(p_person)) then raise exception 'Not allowed'; end if;
  update public.persons set email = nullif(lower(trim(p_email)), '') where id = p_person;
end;
$$;

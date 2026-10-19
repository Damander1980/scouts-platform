-- 0028: kids get their own login (their own email). A parent adds the child's email and records
-- consent; when the child signs in with that email they are linked to their own record.
-- Everything a Scout sends is still logged and copied to parents and designated leaders.

create table if not exists public.child_invites (
  id          uuid primary key default uuid_generate_v4(),
  person_id   uuid not null references public.persons(id) on delete cascade,
  email       text not null,
  created_by  uuid not null references public.persons(id) on delete cascade,
  consent_at  timestamptz not null default now(),
  consent_text text not null,
  used_at     timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);
create unique index if not exists uq_child_invite_open on public.child_invites (lower(email)) where used_at is null and revoked_at is null;
alter table public.child_invites enable row level security;
create policy "child_invites: guardians view" on public.child_invites for select using (public.is_guardian_of(person_id));

create or replace function public.invite_child_login(p_person uuid, p_email text, p_consent_text text)
returns void language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(p_email));
begin
  if not public.is_guardian_of(p_person) then raise exception 'Only a parent or guardian can set up a child login'; end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email address'; end if;
  if exists (select 1 from public.persons where id = p_person and user_id is not null) then raise exception 'This child already has a login'; end if;
  if exists (select 1 from public.users u where lower(u.email) = e and exists (select 1 from public.persons x where x.user_id = u.id)) then
    raise exception 'That email already belongs to another account. Use a different email for this child.';
  end if;
  update public.child_invites set revoked_at = now() where person_id = p_person and used_at is null and revoked_at is null;
  insert into public.child_invites (person_id, email, created_by, consent_text) values (p_person, e, public.my_person_id(), p_consent_text);
  insert into public.audit_log (org_id, actor_id, action, target_type, target_id)
  select m.org_id, public.my_person_id(), 'child_login.invited', 'person', p_person from public.memberships m where m.person_id = p_person;
end;
$$;

create or replace function public.revoke_child_login(p_person uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_guardian_of(p_person) then raise exception 'Not allowed'; end if;
  update public.child_invites set revoked_at = now() where person_id = p_person and used_at is null and revoked_at is null;
  update public.persons set user_id = null where id = p_person and user_id is not null;
end;
$$;

-- Called after sign-in: if this email was invited for a child, link the child's record to this login.
create or replace function public.link_child_login()
returns uuid language plpgsql security definer set search_path = public as $$
declare mail text; inv record;
begin
  select lower(email) into mail from auth.users where id = auth.uid();
  if mail is null then return null; end if;
  if exists (select 1 from public.persons where user_id = auth.uid()) then return null; end if;
  select * into inv from public.child_invites where lower(email) = mail and used_at is null and revoked_at is null order by created_at desc limit 1;
  if inv is null then return null; end if;
  update public.persons set user_id = auth.uid() where id = inv.person_id and user_id is null;
  update public.child_invites set used_at = now() where id = inv.id;
  insert into public.audit_log (org_id, actor_id, action, target_type, target_id)
  select m.org_id, inv.person_id, 'child_login.linked', 'person', inv.person_id from public.memberships m where m.person_id = inv.person_id;
  return inv.person_id;
end;
$$;

-- A Scout (no guardian role) still belongs to a household; prefer guardian households for parents.
create or replace function public.my_household_id()
returns uuid language sql stable security definer as $$
  select hm.household_id from public.household_members hm
  join public.persons p on p.id = hm.person_id
  where p.user_id = auth.uid()
  order by hm.is_guardian desc,
           (select count(*) from public.household_members x where x.household_id = hm.household_id) desc
  limit 1;
$$;

create or replace function public.child_login_status(p_ids uuid[])
returns table (person_id uuid, email text, linked boolean)
language sql stable security definer as $$
  select p.id,
         (select ci.email from public.child_invites ci where ci.person_id = p.id and ci.revoked_at is null order by ci.created_at desc limit 1),
         p.user_id is not null
  from public.persons p where p.id = any(p_ids) and (public.is_guardian_of(p.id) or public.is_own_person(p.id));
$$;

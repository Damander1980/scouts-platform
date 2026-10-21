-- Two-way Scoutbook sync, storage only (Floyd, 2026-10-21: store a leader's Scoutbook login,
-- encrypted, opt-in, revocable). Scoutbook has no API, so the server will sign in as that leader.
-- The password lives in Supabase Vault (encrypted at rest). Nobody can read it back through the
-- app: not leaders, not admins. Only the server's sync job (service role) can decrypt it.
-- Only Key 3 leaders or the advancement chair can connect, since only they can enter
-- advancement in Scoutbook.

create extension if not exists supabase_vault with schema vault;

create table if not exists public.scoutbook_connections (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations(id) on delete cascade,
  person_id          uuid not null references public.persons(id) on delete cascade,
  scoutbook_username text not null,
  scoutbook_position text not null check (scoutbook_position in ('unit_leader','committee_chair','chartered_org_rep','unit_advancement_chair','key3_delegate')),
  secret_id          uuid not null,
  consent_text       text not null,
  created_at         timestamptz not null default now(),
  last_sync_at       timestamptz,
  last_error         text,
  unique (org_id)
);
alter table public.scoutbook_connections enable row level security;
-- Leaders can see that a connection exists and who made it; the secret id is useless without the service role.
create policy "scoutbook_connections: leaders view" on public.scoutbook_connections for select
  using (public.is_org_leader(org_id));

create or replace function public.can_connect_scoutbook(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_org_admin(p_org) or exists (
    select 1 from public.memberships m join public.persons p on p.id = m.person_id
    where m.org_id = p_org and p.user_id = auth.uid() and m.status = 'active'
      and m.role in ('scoutmaster','committee_chair','chartered_org_rep','advancement_chair'));
$$;

create or replace function public.save_scoutbook_login(p_org uuid, p_username text, p_password text, p_position text, p_consent text)
returns void language plpgsql security definer set search_path = public as $$
declare old uuid; sid uuid;
begin
  if not public.can_connect_scoutbook(p_org) then raise exception 'Only Key 3 leaders or the advancement chair can connect Scoutbook'; end if;
  if coalesce(trim(p_username), '') = '' or coalesce(p_password, '') = '' then raise exception 'Enter your Scoutbook username and password'; end if;
  select secret_id into old from public.scoutbook_connections where org_id = p_org;
  if old is not null then delete from vault.secrets where id = old; delete from public.scoutbook_connections where org_id = p_org; end if;
  sid := vault.create_secret(p_password, 'scoutbook-' || p_org::text, 'Scoutbook login for sync');
  insert into public.scoutbook_connections (org_id, person_id, scoutbook_username, scoutbook_position, secret_id, consent_text)
  values (p_org, public.my_person_id(), trim(p_username), p_position, sid, p_consent);
  insert into public.audit_log (org_id, actor_id, action, target_type, payload)
  values (p_org, public.my_person_id(), 'scoutbook.connected', 'scoutbook', jsonb_build_object('username', trim(p_username), 'position', p_position));
end;
$$;

-- Turning sync off deletes the stored login immediately.
create or replace function public.remove_scoutbook_login(p_org uuid)
returns void language plpgsql security definer set search_path = public as $$
declare old uuid;
begin
  if not public.can_connect_scoutbook(p_org) then raise exception 'Not allowed'; end if;
  select secret_id into old from public.scoutbook_connections where org_id = p_org;
  if old is not null then delete from vault.secrets where id = old; end if;
  delete from public.scoutbook_connections where org_id = p_org;
  insert into public.audit_log (org_id, actor_id, action, target_type, payload)
  values (p_org, public.my_person_id(), 'scoutbook.disconnected', 'scoutbook', '{}'::jsonb);
end;
$$;

-- Server-side only: the sync job reads the password with the service role.
create or replace function public.scoutbook_login_for_sync(p_org uuid)
returns table (username text, password text)
language sql stable security definer set search_path = public as $$
  select c.scoutbook_username, s.decrypted_secret
  from public.scoutbook_connections c join vault.decrypted_secrets s on s.id = c.secret_id
  where c.org_id = p_org;
$$;

revoke all on function public.scoutbook_login_for_sync(uuid) from public, anon, authenticated;
grant execute on function public.scoutbook_login_for_sync(uuid) to service_role;
grant execute on function public.can_connect_scoutbook(uuid) to authenticated;
grant execute on function public.save_scoutbook_login(uuid, text, text, text, text) to authenticated;
grant execute on function public.remove_scoutbook_login(uuid) to authenticated;

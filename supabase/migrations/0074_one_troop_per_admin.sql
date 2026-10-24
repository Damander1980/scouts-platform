-- One troop per founder (Floyd, 2026-10-23): someone who already runs a troop can't start another one.
-- Joining a second troop (a family with Scouts in two units) still works; only creating is blocked.
-- The platform owner is exempt, for testing and support.
create or replace function public.create_organization(p_type text, p_number text, p_city text, p_state text, p_word text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid; oid uuid; base text; s text; n int := 1;
begin
  me := public.my_person_id();
  if me is null then raise exception 'Finish your profile first'; end if;
  -- One at a time per person: two quick presses can't both pass the check below and start two troops.
  perform pg_advisory_xact_lock(hashtext('create_organization:' || me::text));
  if exists (select 1 from public.memberships m where m.person_id = me and m.is_admin and m.status = 'active')
     and not public.am_platform_owner() then
    raise exception 'You already run a troop. Each admin can start one troop; ask us if you need help with another.';
  end if;
  base := lower(regexp_replace(p_word || p_number || p_city, '[^A-Za-z0-9]', '', 'g'));
  s := base;
  while exists (select 1 from public.organizations where slug = s) loop n := n + 1; s := base || n; end loop;
  insert into public.organizations (name, type, unit_number, city, state, slug)
  values (trim(p_word || ' ' || p_number), p_type, trim(p_number), trim(p_city), nullif(trim(p_state), ''), s)
  returning id into oid;
  insert into public.memberships (org_id, person_id, role, status, is_admin, is_designated_leader)
  values (oid, me, 'scoutmaster', 'active', true, true);
  return oid;
end;
$$;

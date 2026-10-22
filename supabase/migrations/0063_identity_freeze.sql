-- Rows that say "this person is in this unit" can't be repointed. An admin could otherwise update a
-- membership (or patrol/position row) of their own self-made unit to name any child on the platform,
-- getting around every person_in_org check. merge_persons moves rows deliberately and sets app.merging.
create or replace function public.freeze_member_identity()
returns trigger language plpgsql set search_path = public as $$
begin
  if (new.person_id is distinct from old.person_id or new.org_id is distinct from old.org_id)
     and coalesce(current_setting('app.merging', true), '') <> 'on' then
    raise exception 'A membership can''t be moved to another person or unit; add a new one instead';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_freeze_identity on public.memberships;
create trigger trg_freeze_identity before update on public.memberships for each row execute function public.freeze_member_identity();
drop trigger if exists trg_freeze_identity on public.position_holders;
create trigger trg_freeze_identity before update on public.position_holders for each row execute function public.freeze_member_identity();
drop trigger if exists trg_freeze_identity on public.patrol_members;
create trigger trg_freeze_identity before update on public.patrol_members for each row execute function public.freeze_member_identity();

-- Patrol rosters: only people in the unit, only the unit's own patrols (patrol messages reach a patrol's
-- members, so an outside child on a roster could be messaged).
drop policy if exists "patrol_members: leaders manage" on public.patrol_members;
create policy "patrol_members: leaders manage" on public.patrol_members for all using (public.is_org_leader(org_id))
  with check (public.is_org_leader(org_id) and public.person_in_org(person_id, org_id)
    and exists (select 1 from public.patrols p where p.id = patrol_id and p.org_id = patrol_members.org_id));

-- A new phone number needs its own consent before any text goes to it (TCPA/10DLC).
create or replace function public.reset_sms_consent()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.sms_phone is distinct from old.sms_phone and new.sms_consent_at is not distinct from old.sms_consent_at then
    new.sms_consent_at := null;
    new.sms_on := false;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_reset_sms_consent on public.notification_prefs;
create trigger trg_reset_sms_consent before update on public.notification_prefs for each row execute function public.reset_sms_consent();

-- Document links: web addresses only (existing rows are left alone).
alter table public.documents drop constraint if exists documents_url_web;
alter table public.documents add constraint documents_url_web check (url ~* '^https?://') not valid;

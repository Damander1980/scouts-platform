-- Advancement integrity (SPEC: only the Scoutmaster, assistants and counselors sign off; Scouts can't
-- approve their own).
-- * Rows must belong to the Scout's own unit: a leader of a self-made unit could forge sign-offs and
--   badges for a Troop 999 Scout (and block the troop's own records).
-- * Updates re-check the row (no WITH CHECK before: a family could move a row to another unit).
-- * Only leaders assign counselors, approve badge starts or change status beyond requested/declined;
--   a Scout could skip the blue-card approval and pick their own counselor.
-- * Families can only remove a badge that hasn't started; completed awards can't be deleted by them.
-- * A counselor signs off only Scouts assigned to them (or any, while none is assigned).
-- * "Approved by" is always the person actually signing.
-- * approve_badge_start needs a requested/assigned badge and an approved counselor.
-- * sign_permission only in a unit the Scout belongs to; request_join doesn't pile up duplicates.

create or replace function public.can_sign_for(p_org uuid, p_req uuid, p_person uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_org_leader(p_org)
      or exists (
        select 1 from public.advancement_requirements r
        join public.advancement_items i on i.id = r.item_id
        where r.id = p_req and i.kind = 'badge' and public.can_counsel(p_org, i.id)
          and not exists (select 1 from public.scout_advancement a where a.person_id = p_person and a.item_id = i.id
                          and a.counselor_id is not null and a.counselor_id <> public.my_person_id())
      );
$$;

create or replace function public.guard_signoff()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.person_in_org(new.person_id, new.org_id) then raise exception 'That Scout is not in this unit'; end if;
  if (tg_op = 'INSERT' and new.approved_by is not null)
     or (tg_op = 'UPDATE' and (new.approved_by is distinct from old.approved_by
                               or (old.approved_by is not null and new.completed_at is distinct from old.completed_at))) then
    if not public.can_sign_for(new.org_id, new.requirement_id, new.person_id) then
      raise exception 'Only a unit leader or this Scout''s counselor for the badge can sign off this requirement';
    end if;
    if new.approved_by is not null then
      new.approved_by := public.my_person_id();
      new.approved_at := coalesce(new.approved_at, now()); -- imports carry the original date
    end if;
  end if;
  return new;
end;
$$;

drop policy if exists "req_progress: family, leader, or counselor insert" on public.requirement_progress;
drop policy if exists "req_progress: family, leader, or counselor update" on public.requirement_progress;
create policy "req_progress: family, leader, or counselor insert" on public.requirement_progress
  for insert with check (public.is_org_member(org_id) and public.person_in_org(person_id, org_id)
    and (public.can_act_for(person_id) or public.can_sign_requirement(org_id, requirement_id)));
create policy "req_progress: family, leader, or counselor update" on public.requirement_progress
  for update using (public.can_act_for(person_id) or public.can_sign_requirement(org_id, requirement_id))
  with check (public.person_in_org(person_id, org_id)
    and (public.can_act_for(person_id) or public.can_sign_requirement(org_id, requirement_id)));

drop policy if exists "scout_adv: own or leader insert" on public.scout_advancement;
create policy "scout_adv: own or leader insert" on public.scout_advancement
  for insert with check (public.is_org_member(org_id) and public.person_in_org(person_id, org_id)
    and (public.is_own_person(person_id) or public.is_org_leader(org_id)));
drop policy if exists "scout_adv: own, leader, or counselor update" on public.scout_advancement;
create policy "scout_adv: own, leader, or counselor update" on public.scout_advancement
  for update using (public.is_own_person(person_id) or public.is_org_leader(org_id) or public.can_counsel(org_id, item_id))
  with check (public.person_in_org(person_id, org_id)
    and (public.is_own_person(person_id) or public.is_org_leader(org_id) or public.can_counsel(org_id, item_id)));
drop policy if exists "scout_adv: leader delete" on public.scout_advancement;
create policy "scout_adv: leader delete" on public.scout_advancement
  for delete using (public.is_org_leader(org_id) or (public.is_own_person(person_id) and status in ('requested', 'assigned', 'declined')));

-- What a Scout (not a leader or counselor) may change on their own record: ask, or withdraw.
create or replace function public.guard_scout_adv_changes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_org_leader(old.org_id) then return new; end if;
  if new.org_id is distinct from old.org_id or new.person_id is distinct from old.person_id or new.item_id is distinct from old.item_id
     or new.approved_to_start_by is distinct from old.approved_to_start_by or new.approved_to_start_at is distinct from old.approved_to_start_at
     or new.counselor_id is distinct from old.counselor_id then
    raise exception 'Only a unit leader can approve a badge start or assign a counselor';
  end if;
  if new.status is distinct from old.status and not public.can_counsel(old.org_id, old.item_id)
     and new.status not in ('requested', 'declined') then
    raise exception 'A leader or counselor updates where this stands';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_scout_adv_changes on public.scout_advancement;
create trigger trg_guard_scout_adv_changes before update on public.scout_advancement
  for each row execute function public.guard_scout_adv_changes();

create or replace function public.approve_badge_start(p_adv uuid, p_counselor uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a record;
begin
  select * into a from public.scout_advancement where id = p_adv;
  if a is null or not public.is_org_leader(a.org_id) then raise exception 'Only unit leaders approve merit badge starts'; end if;
  if a.status not in ('requested', 'assigned') then raise exception 'This badge has already started or finished'; end if;
  if p_counselor is null or not exists (select 1 from public.merit_badge_counselors c
      where c.org_id = a.org_id and c.person_id = p_counselor and c.item_id = a.item_id) then
    raise exception 'Pick a counselor approved for this merit badge';
  end if;
  update public.scout_advancement set status = 'in_progress', counselor_id = p_counselor,
    approved_to_start_by = public.my_person_id(), approved_to_start_at = now() where id = p_adv;
  insert into public.audit_log (org_id, actor_id, action, target_type, target_id, payload)
  values (a.org_id, public.my_person_id(), 'badge.approved_to_start', 'scout_advancement', p_adv, jsonb_build_object('counselor', p_counselor));
end;
$$;

create or replace function public.sign_permission(p_org uuid, p_person uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_guardian_of(p_person) then raise exception 'Only a parent or guardian can sign'; end if;
  if not public.person_in_org(p_person, p_org) then raise exception 'Your Scout is not in this unit'; end if;
  insert into public.forms (org_id, person_id, type, signed_by, signed_at, expires_at, status)
  values (p_org, p_person, 'permission', public.my_person_id(), now(), now() + interval '1 year', 'received')
  on conflict (org_id, person_id, type) do update set signed_by = excluded.signed_by, signed_at = now(),
    expires_at = excluded.expires_at, status = 'received';
  insert into public.audit_log (org_id, actor_id, action, target_type, target_id)
  values (p_org, public.my_person_id(), 'form.permission_signed', 'person', p_person);
end;
$$;

create or replace function public.request_join(p_org uuid, p_person_ids uuid[], p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid; pid uuid; rid uuid; ids uuid[];
begin
  me := public.my_person_id();
  if me is null then raise exception 'Finish your profile first'; end if;
  if not exists (select 1 from public.organizations where id = p_org) then raise exception 'Unit not found'; end if;
  foreach pid in array p_person_ids loop
    if not public.can_act_for(pid) then raise exception 'You can only request to join for yourself and your family'; end if;
  end loop;
  -- People already in the unit don't need to ask.
  select coalesce(array_agg(x), '{}') into ids from unnest(p_person_ids) x
    where not exists (select 1 from public.memberships m where m.org_id = p_org and m.person_id = x and m.status = 'active');
  if cardinality(ids) = 0 then raise exception 'Everyone you picked is already in this unit'; end if;
  -- Asking again updates the pending request instead of adding another for the leaders to sort through.
  select id into rid from public.join_requests where org_id = p_org and requested_by = me and status = 'pending' limit 1;
  if rid is not null then
    update public.join_requests set person_ids = (select array_agg(distinct y) from unnest(person_ids || ids) y),
      note = coalesce(nullif(p_note, ''), note) where id = rid;
    return rid;
  end if;
  insert into public.join_requests (org_id, requested_by, person_ids, note)
  values (p_org, me, ids, p_note) returning id into rid;
  return rid;
end;
$$;

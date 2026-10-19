-- 0026: parent deletion requests — confirm and cancel. Nothing is erased automatically:
-- the spec leaves the final erase and any legal-hold pause rules to a lawyer, so a unit admin
-- is notified through the audit log and the request waits for the 14-day period.

create or replace function public.confirm_deletion(p_request uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from public.deletion_requests where id = p_request;
  if r is null or not public.is_own_person(r.requested_by) then raise exception 'Not allowed'; end if;
  if r.status <> 'pending' then raise exception 'This request was already handled'; end if;
  update public.deletion_requests set status = 'confirmed', execute_after = now() + interval '14 days' where id = p_request;
  insert into public.audit_log (org_id, actor_id, action, target_type, target_id, payload)
  select m.org_id, public.my_person_id(), 'deletion.confirmed', 'person', r.person_id, jsonb_build_object('execute_after', now() + interval '14 days')
  from public.memberships m where m.person_id = r.person_id;
end;
$$;

create or replace function public.cancel_deletion(p_request uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from public.deletion_requests where id = p_request;
  if r is null or not public.is_own_person(r.requested_by) then raise exception 'Not allowed'; end if;
  if r.status not in ('pending','confirmed','paused') then raise exception 'This request can no longer be canceled'; end if;
  update public.deletion_requests set status = 'canceled' where id = p_request;
  insert into public.audit_log (org_id, actor_id, action, target_type, target_id)
  select m.org_id, public.my_person_id(), 'deletion.canceled', 'person', r.person_id from public.memberships m where m.person_id = r.person_id;
end;
$$;

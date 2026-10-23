-- Tetanus shot date and swim check date are recorded like the other health parts: status and date only,
-- no documents. Tetanus lasts 10 years; a swim check lasts to the end of the 12th month after it.
create or replace function public.mark_form(p_org uuid, p_person uuid, p_type text, p_date date, p_received boolean)
returns void language plpgsql security definer set search_path = public as $$
declare exp timestamptz;
begin
  if not public.is_designated(p_org) then raise exception 'Only designated leaders can record forms'; end if;
  if p_type not in ('health_ab','health_c','permission','other','tetanus','swim_check') then raise exception 'Unknown form type'; end if;
  if not public.person_in_org(p_person, p_org) then raise exception 'That person is not in this unit'; end if;
  if p_received then
    exp := case when p_type = 'tetanus'
                then (date_trunc('month', coalesce(p_date, current_date)) + interval '121 months' - interval '1 second')
                else (date_trunc('month', coalesce(p_date, current_date)) + interval '13 months' - interval '1 second') end;
    insert into public.forms (org_id, person_id, type, exam_date, signed_at, expires_at, status, marked_by)
    values (p_org, p_person, p_type, p_date, now(), exp, 'received', public.my_person_id())
    on conflict (org_id, person_id, type) do update set exam_date = excluded.exam_date, signed_at = now(),
      expires_at = excluded.expires_at, status = 'received', marked_by = excluded.marked_by;
  else
    delete from public.forms where org_id = p_org and person_id = p_person and type = p_type;
  end if;
  insert into public.audit_log (org_id, actor_id, action, target_type, target_id, payload)
  values (p_org, public.my_person_id(), 'form.' || case when p_received then 'received' else 'cleared' end, 'person', p_person,
          jsonb_build_object('type', p_type, 'date', p_date));
end;
$$;

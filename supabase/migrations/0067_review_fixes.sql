-- Review fixes: a merge keeps the original approver on sign-offs, and an import row with an unreadable date is skipped instead of dated today.
create or replace function public.guard_signoff()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- merge_persons re-points who signed; it must not be rewritten to the merging admin.
  if coalesce(current_setting('app.merging', true), '') = 'on' then return new; end if;
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

create or replace function public.import_advancement(p_org uuid, p_file text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r jsonb; pid uuid; iid uuid; rid uuid; me uuid; aid uuid; prid uuid; d timestamptz;
  made_adv uuid[] := '{}'; made_prog uuid[] := '{}'; matched int := 0; skipped int := 0; bid uuid;
begin
  if not public.is_org_admin(p_org) then raise exception 'Only unit admins can import'; end if;
  me := public.my_person_id();
  for r in select * from jsonb_array_elements(p_rows) loop
    pid := public.import_match_scout(p_org, r->>'member_id', r->>'first', r->>'last');
    select i.id into iid from public.advancement_items i
      where lower(i.name) = lower(trim(r->>'item'))
         or lower(i.name) = lower(regexp_replace(trim(r->>'item'), '\s*(rank|merit badge)$', '', 'i'))
         or (lower(trim(r->>'item')) = 'eagle' and i.code = 'eagle')
      order by (i.program = 'scouts_bsa') desc limit 1;
    if pid is null or iid is null then skipped := skipped + 1; continue; end if;
    d := public.import_date(r->>'date', p_org);
    if d is null then skipped := skipped + 1; continue; end if; -- no date, no record: never stamp today

    if coalesce(trim(r->>'requirement'), '') <> '' then
      select id into rid from public.advancement_requirements
        where item_id = iid and lower(number) = lower(regexp_replace(trim(r->>'requirement'), '^#', '')) limit 1;
      if rid is null then skipped := skipped + 1; continue; end if;
      prid := null;
      insert into public.requirement_progress (org_id, person_id, requirement_id, completed_at, approved_by, approved_at)
      values (p_org, pid, rid, d, me, d)
      on conflict (person_id, requirement_id) do nothing returning id into prid;
      if prid is not null then made_prog := made_prog || prid; end if;
    else
      aid := null;
      -- Only a new record is the import's to undo; an in-progress one is marked complete and stays so.
      if not exists (select 1 from public.scout_advancement where person_id = pid and item_id = iid) then
        insert into public.scout_advancement (org_id, person_id, item_id, status, completed_at)
        values (p_org, pid, iid, 'completed', d) returning id into aid;
        made_adv := made_adv || aid;
      else
        update public.scout_advancement set status = 'completed', completed_at = d
          where person_id = pid and item_id = iid and status <> 'completed';
      end if;
    end if;
    matched := matched + 1;
  end loop;
  insert into public.import_batches (org_id, kind, file_name, row_count, created_by, created_ids)
  values (p_org, 'advancement', p_file, matched, me, jsonb_build_object('advancement', to_jsonb(made_adv), 'progress', to_jsonb(made_prog)))
  returning id into bid;
  return jsonb_build_object('batch', bid, 'matched', matched, 'skipped', skipped);
end;
$$;

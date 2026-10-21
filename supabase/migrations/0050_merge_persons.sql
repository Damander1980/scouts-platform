-- Merge duplicate person records (SPEC: User management). Moves everything that points at the
-- duplicate onto the record being kept, row by row; where the kept record already has the same row
-- (for example both RSVP'd to one event) the duplicate's row is dropped. Append-only records such
-- as the message log can't be rewritten and simply stay attached to the old record, which is kept
-- (inactive) rather than deleted so nothing is lost. Only unit admins, only within their unit.

create or replace function public.merge_persons(p_org uuid, p_keep uuid, p_drop uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  fk record; r record; moved int := 0; keep_user uuid; drop_user uuid;
begin
  if not public.is_org_admin(p_org) then raise exception 'Only a unit admin can merge records'; end if;
  if p_keep = p_drop then raise exception 'Pick two different people'; end if;
  if not exists (select 1 from public.memberships where org_id = p_org and person_id = p_keep)
     or not exists (select 1 from public.memberships where org_id = p_org and person_id = p_drop) then
    raise exception 'Both people must be in this unit';
  end if;
  if exists (select 1 from public.memberships where person_id = p_drop and org_id <> p_org) then
    raise exception 'That record also belongs to another unit, so it can''t be merged from here';
  end if;
  if (select type from public.persons where id = p_keep) <> (select type from public.persons where id = p_drop) then
    raise exception 'Only merge a youth with a youth, or an adult with an adult';
  end if;
  select user_id into keep_user from public.persons where id = p_keep;
  select user_id into drop_user from public.persons where id = p_drop;
  if keep_user is not null and drop_user is not null then
    raise exception 'Both records have their own login; ask one person to stop using theirs first';
  end if;

  -- Every foreign key in public that points at persons(id).
  for fk in
    select cl.relname as tbl, a.attname as col
    from pg_constraint con
    join pg_class cl on cl.oid = con.conrelid
    join pg_namespace n on n.oid = cl.relnamespace
    join pg_attribute a on a.attrelid = con.conrelid and a.attnum = con.conkey[1]
    where con.contype = 'f' and con.confrelid = 'public.persons'::regclass and n.nspname = 'public'
      and array_length(con.conkey, 1) = 1
  loop
    for r in execute format('select ctid from public.%I where %I = $1', fk.tbl, fk.col) using p_drop loop
      begin
        execute format('update public.%I set %I = $1 where ctid = $2', fk.tbl, fk.col) using p_keep, r.ctid;
        moved := moved + 1;
      exception
        when unique_violation then
          -- The kept record already has this row; the duplicate's copy goes, except in tables that never delete.
          begin execute format('delete from public.%I where ctid = $1', fk.tbl) using r.ctid; exception when others then null; end;
        when others then null; -- append-only tables (message log) refuse updates; leave those rows as they are
      end;
    end loop;
  end loop;

  if drop_user is not null then
    update public.persons set user_id = null where id = p_drop;
    update public.persons set user_id = drop_user where id = p_keep;
  end if;
  update public.memberships set status = 'inactive' where person_id = p_drop;

  insert into public.audit_log (org_id, actor_id, action, target_type, target_id, payload)
  values (p_org, public.my_person_id(), 'person.merged', 'person', p_keep, jsonb_build_object('merged', p_drop, 'rows', moved));
  return moved;
end;
$$;
grant execute on function public.merge_persons(uuid, uuid, uuid) to authenticated;

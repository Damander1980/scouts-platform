-- Scoutbook is the official record, so the app tracks which completed advancement has been sent
-- there. Leaders download a changes-only upload file; downloading it marks those rows exported.
-- Rows that existed before this migration start as not exported, so the first file contains
-- everything (Scoutbook skips duplicates it already has).

alter table public.scout_advancement add column if not exists scoutbook_exported_at timestamptz;
alter table public.requirement_progress add column if not exists scoutbook_exported_at timestamptz;

-- How many completed items are not yet in a Scoutbook upload file.
create or replace function public.scoutbook_pending(p_org uuid)
returns integer language sql stable security definer set search_path = public as $$
  select case when not public.is_org_leader(p_org) then 0 else
    (select count(*)::int from public.scout_advancement
      where org_id = p_org and status = 'completed' and scoutbook_exported_at is null)
    + (select count(*)::int from public.requirement_progress
      where org_id = p_org and approved_by is not null and scoutbook_exported_at is null)
  end;
$$;

-- Marks the rows that went into a downloaded upload file.
create or replace function public.mark_scoutbook_exported(p_org uuid, p_adv uuid[], p_req uuid[])
returns integer language plpgsql security definer set search_path = public as $$
declare n1 int; n2 int;
begin
  if not public.is_org_leader(p_org) then raise exception 'Only leaders can export advancement'; end if;
  update public.scout_advancement set scoutbook_exported_at = now()
    where org_id = p_org and id = any(p_adv) and scoutbook_exported_at is null;
  get diagnostics n1 = row_count;
  update public.requirement_progress set scoutbook_exported_at = now()
    where org_id = p_org and id = any(p_req) and scoutbook_exported_at is null;
  get diagnostics n2 = row_count;
  insert into public.audit_log (org_id, actor_id, action, target_type, payload)
  values (p_org, public.my_person_id(), 'scoutbook.exported', 'advancement', jsonb_build_object('items', n1, 'requirements', n2));
  return n1 + n2;
end;
$$;

grant execute on function public.scoutbook_pending(uuid) to authenticated;
grant execute on function public.mark_scoutbook_exported(uuid, uuid[], uuid[]) to authenticated;

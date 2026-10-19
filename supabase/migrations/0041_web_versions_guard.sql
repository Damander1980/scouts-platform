-- 0040 made web_page_versions read-only with a DO INSTEAD NOTHING rule, which also swallowed
-- the "on delete set null" cleanup of published_by when a person is deleted. Replace the rule
-- with a trigger that allows exactly that cleanup and nothing else.
drop rule if exists web_version_no_update on public.web_page_versions;

create or replace function public.web_version_guard() returns trigger
language plpgsql set search_path = public as $$
declare expected public.web_page_versions;
begin
  expected := old;
  expected.published_by := null;
  if old.published_by is not null and new is not distinct from expected then
    return new;
  end if;
  raise exception 'Published versions cannot be changed';
end;
$$;
drop trigger if exists web_version_guard on public.web_page_versions;
create trigger web_version_guard before update on public.web_page_versions for each row execute function public.web_version_guard();

-- Restore now brings back the version's title too, and returns what it restored so the
-- editor can show it without a reload.
drop function if exists public.restore_site_version(uuid);
create function public.restore_site_version(p_version uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v record;
begin
  select * into v from public.web_page_versions where id = p_version;
  if v is null or not public.can_edit_site(v.org_id) then raise exception 'Not allowed'; end if;
  update public.web_pages set draft = v.blocks, title = v.title, updated_at = now(), updated_by = public.my_person_id() where id = v.page_id;
  return jsonb_build_object('title', v.title, 'blocks', v.blocks);
end;
$$;
grant execute on function public.restore_site_version(uuid) to authenticated;

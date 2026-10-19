-- 0040 made web_page_versions read-only with a DO INSTEAD NOTHING rule, which also swallowed
-- the "on delete set null" cleanup of published_by when a person is deleted. Replace the rule
-- with a trigger that allows only that cleanup.
drop rule if exists web_version_no_update on public.web_page_versions;

create or replace function public.web_version_guard() returns trigger language plpgsql as $$
begin
  if new.published_by is null and old.published_by is not null
     and new.page_id = old.page_id and new.org_id = old.org_id and new.title = old.title
     and new.blocks = old.blocks and new.published_at = old.published_at then
    return new;
  end if;
  raise exception 'Published versions cannot be changed';
end;
$$;
drop trigger if exists web_version_guard on public.web_page_versions;
create trigger web_version_guard before update on public.web_page_versions for each row execute function public.web_version_guard();

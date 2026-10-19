-- Website builder: extra pages built from blocks, on top of the existing home page.
-- Each page keeps a draft and a published copy. Publishing snapshots the draft into
-- site_page_versions so an editor can roll back. Pages are public or members-only.
-- Youth photo rules still apply: image and album blocks only show photos that the
-- existing public_site() / album rules already allow.

create table if not exists public.site_pages (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  slug        text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,40}$'),
  title       text not null check (length(trim(title)) between 1 and 80),
  sort        integer not null default 100,
  visibility  text not null default 'public' check (visibility in ('public','members')),
  draft       jsonb not null default '[]',
  published   jsonb,
  published_at timestamptz,
  show_in_menu boolean not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.persons(id) on delete set null,
  unique (org_id, slug)
);
alter table public.site_pages enable row level security;

create table if not exists public.site_page_versions (
  id          uuid primary key default uuid_generate_v4(),
  page_id     uuid not null references public.site_pages(id) on delete cascade,
  org_id      uuid not null references public.organizations(id) on delete cascade,
  title       text not null,
  blocks      jsonb not null,
  published_at timestamptz not null default now(),
  published_by uuid references public.persons(id) on delete set null
);
create index if not exists site_page_versions_page on public.site_page_versions (page_id, published_at desc);
alter table public.site_page_versions enable row level security;
create rule site_version_no_update as on update to public.site_page_versions do instead nothing;

create or replace function public.can_edit_site(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_org_admin(org) or public.has_perm(org, 'site.edit');
$$;
grant execute on function public.can_edit_site(uuid) to authenticated;

create policy "site_pages: editors" on public.site_pages for all
  using (public.can_edit_site(org_id)) with check (public.can_edit_site(org_id));
create policy "site_versions: editors view" on public.site_page_versions for select using (public.can_edit_site(org_id));

-- Publish: copy draft to published and record a version.
create or replace function public.publish_site_page(p_page uuid)
returns void language plpgsql security definer set search_path = public as $$
declare pg record;
begin
  select * into pg from public.site_pages where id = p_page;
  if pg is null or not public.can_edit_site(pg.org_id) then raise exception 'Not allowed'; end if;
  update public.site_pages set published = draft, published_at = now(), updated_at = now(), updated_by = public.my_person_id() where id = p_page;
  insert into public.site_page_versions (page_id, org_id, title, blocks, published_by)
  values (p_page, pg.org_id, pg.title, pg.draft, public.my_person_id());
end;
$$;

-- Roll back: load an old version into the draft (the editor then reviews and publishes).
create or replace function public.restore_site_version(p_version uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v record;
begin
  select * into v from public.site_page_versions where id = p_version;
  if v is null or not public.can_edit_site(v.org_id) then raise exception 'Not allowed'; end if;
  update public.site_pages set draft = v.blocks, updated_at = now(), updated_by = public.my_person_id() where id = v.page_id;
end;
$$;

-- Menu for the public site: published pages the viewer may see.
create or replace function public.site_menu(p_slug text)
returns table (slug text, title text, visibility text)
language sql stable security definer set search_path = public as $$
  select p.slug, p.title, p.visibility from public.site_pages p join public.organizations o on o.id = p.org_id
  where o.slug = lower(p_slug) and p.published is not null and p.show_in_menu
    and (p.visibility = 'public' or public.is_org_member(o.id))
  order by p.sort, p.title;
$$;

-- One published page, if the viewer may see it. Members-only pages need a signed-in member.
create or replace function public.site_page(p_slug text, p_page text)
returns table (title text, visibility text, blocks jsonb, published_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.title, p.visibility, p.published, p.published_at from public.site_pages p join public.organizations o on o.id = p.org_id
  where o.slug = lower(p_slug) and p.slug = lower(p_page) and p.published is not null
    and (p.visibility = 'public' or public.is_org_member(o.id));
$$;

grant execute on function public.publish_site_page(uuid) to authenticated;
grant execute on function public.restore_site_version(uuid) to authenticated;
grant execute on function public.site_menu(text) to anon, authenticated;
grant execute on function public.site_page(text, text) to anon, authenticated;

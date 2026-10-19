-- Discussion forums. Youth protection (SPEC "Communication with minors"):
--  * group threads only, never one-on-one;
--  * posts are append-only, nobody can edit or delete them (same as message_log);
--  * a topic is 'adults' (adults only) or 'everyone'. Scouts with logins (13+) can only see
--    and post in 'everyone' topics, which every parent and leader in the unit can read,
--    so a Scout's post is always visible to parents and leaders.
-- Leaders can lock or pin a topic; they cannot remove posts.

create table if not exists public.forum_topics (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  title       text not null check (length(trim(title)) between 1 and 200),
  audience    text not null default 'everyone' check (audience in ('everyone','adults')),
  created_by  uuid references public.persons(id) on delete set null,
  created_at  timestamptz not null default now(),
  last_post_at timestamptz not null default now(),
  locked      boolean not null default false,
  pinned      boolean not null default false
);
create index if not exists forum_topics_org on public.forum_topics (org_id, pinned desc, last_post_at desc);

create table if not exists public.forum_posts (
  id          uuid primary key default gen_random_uuid(),
  topic_id    uuid not null references public.forum_topics(id) on delete cascade,
  org_id      uuid not null references public.organizations(id) on delete cascade,
  author_id   uuid not null references public.persons(id) on delete cascade,
  body        text not null check (length(trim(body)) between 1 and 10000),
  created_at  timestamptz not null default now()
);
create index if not exists forum_posts_topic on public.forum_posts (topic_id, created_at);

alter table public.forum_topics enable row level security;
alter table public.forum_posts enable row level security;
create rule forum_post_no_update as on update to public.forum_posts do instead nothing;
create rule forum_post_no_delete as on delete to public.forum_posts do instead nothing;

-- Can the signed-in user see topics with this audience in this unit?
create or replace function public.forum_can_view(org uuid, aud text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m join public.persons p on p.id = m.person_id
    where m.org_id = org and m.status = 'active' and p.user_id = auth.uid()
      and (aud = 'everyone' or p.type = 'adult')
  );
$$;
grant execute on function public.forum_can_view(uuid, text) to authenticated;

create policy "forum_topics: view" on public.forum_topics for select using (public.forum_can_view(org_id, audience));
create policy "forum_topics: create" on public.forum_topics for insert
  with check (public.forum_can_view(org_id, audience) and public.is_own_person(created_by));
create policy "forum_topics: leaders moderate" on public.forum_topics for update
  using (public.is_org_leader(org_id) or public.is_org_admin(org_id))
  with check (public.is_org_leader(org_id) or public.is_org_admin(org_id));

create policy "forum_posts: view" on public.forum_posts for select using (
  exists (select 1 from public.forum_topics t where t.id = topic_id and public.forum_can_view(t.org_id, t.audience)));
create policy "forum_posts: create" on public.forum_posts for insert with check (
  public.is_own_person(author_id)
  and exists (select 1 from public.forum_topics t where t.id = topic_id and t.org_id = forum_posts.org_id
              and not t.locked and public.forum_can_view(t.org_id, t.audience)));

-- Keep the topic list sorted by latest activity. Security definer so posters do not need
-- update rights on topics.
create or replace function public.forum_touch_topic() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.forum_topics set last_post_at = new.created_at where id = new.topic_id;
  return new;
end;
$$;
drop trigger if exists forum_post_touch on public.forum_posts;
create trigger forum_post_touch after insert on public.forum_posts for each row execute function public.forum_touch_topic();

-- Moderation may only lock or pin; title, audience and author are fixed once posted.
create or replace function public.forum_topic_guard() returns trigger language plpgsql as $$
begin
  if new.title <> old.title or new.audience <> old.audience or new.org_id <> old.org_id
     or new.created_by is distinct from old.created_by or new.created_at <> old.created_at then
    raise exception 'Only lock and pin can change on a topic';
  end if;
  return new;
end;
$$;
drop trigger if exists forum_topic_guard on public.forum_topics;
create trigger forum_topic_guard before update on public.forum_topics for each row
  when (pg_trigger_depth() = 0) execute function public.forum_topic_guard();

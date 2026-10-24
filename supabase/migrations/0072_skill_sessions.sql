-- Skill modules (Floyd, 2026-10-23). A module is a reusable skill a troop teaches ("Knots": Tenderfoot 3a, 3b,
-- 3c...), set up once with notes and a video link and edited any time. A session puts a module on a meeting
-- date, so Trail to First Class Scouts see it ahead of time and practice before they get there.
create table if not exists public.skill_modules (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  title           text not null check (length(trim(title)) between 1 and 80),
  requirement_ids uuid[] not null default '{}',
  notes           text check (notes is null or length(notes) <= 1000),
  -- Videos and visual guides: [{"label": "Square knot video", "url": "https://..."}]
  links           jsonb not null default '[]'::jsonb check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 10
                    and not jsonb_path_exists(links, '$[*] ? (!(@.url like_regex "^https?://"))')),
  sort            int not null default 0,
  created_by      uuid references public.persons(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists skill_modules_org on public.skill_modules (org_id, sort);
alter table public.skill_modules enable row level security;
create policy "skill_modules: members read" on public.skill_modules for select using (public.is_org_member(org_id));
create policy "skill_modules: leaders manage" on public.skill_modules
  for all using (public.is_org_leader(org_id)) with check (public.is_org_leader(org_id));

create table if not exists public.skill_sessions (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  module_id  uuid not null references public.skill_modules(id) on delete cascade,
  on_date    date not null,
  event_id   uuid references public.events(id) on delete set null,
  created_by uuid references public.persons(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists skill_sessions_org_date on public.skill_sessions (org_id, on_date);
alter table public.skill_sessions enable row level security;
create policy "skill_sessions: members read" on public.skill_sessions for select using (public.is_org_member(org_id));
create policy "skill_sessions: leaders manage" on public.skill_sessions
  for all using (public.is_org_leader(org_id))
  with check (public.is_org_leader(org_id)
    and exists (select 1 from public.skill_modules m where m.id = module_id and m.org_id = skill_sessions.org_id)
    and (event_id is null or exists (select 1 from public.events e where e.id = event_id and e.org_id = skill_sessions.org_id)));

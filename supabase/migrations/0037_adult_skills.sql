-- Adult skills and interests inventory: parents and leaders say what they can help with,
-- leaders search it when they need a driver, a cook, a merit badge counselor and so on.
-- Adults only; one row per person per unit. The person edits their own row.

create table if not exists public.adult_skills (
  org_id     uuid not null references public.organizations(id) on delete cascade,
  person_id  uuid not null references public.persons(id) on delete cascade,
  skills     text[] not null default '{}',
  other      text,
  can_drive  boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (org_id, person_id)
);
alter table public.adult_skills enable row level security;

create policy "adult_skills: own or leaders view" on public.adult_skills for select
  using (public.is_own_person(person_id) or public.is_org_leader(org_id) or public.has_perm(org_id, 'volunteer.manage'));
create policy "adult_skills: own insert" on public.adult_skills for insert
  with check (public.is_own_person(person_id) and public.is_org_member(org_id));
create policy "adult_skills: own update" on public.adult_skills for update
  using (public.is_own_person(person_id)) with check (public.is_own_person(person_id) and public.is_org_member(org_id));
create policy "adult_skills: own delete" on public.adult_skills for delete
  using (public.is_own_person(person_id));

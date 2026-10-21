-- Patrol Leaders' Council space (SPEC: Patrols and youth leadership). The youth leaders plan the
-- program; adults see and review everything. Members: Senior Patrol Leader, Assistant SPL,
-- patrol leaders and assistant patrol leaders (current), plus unit leaders.

create or replace function public.is_plc_member(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_org_leader(org) or exists (
    select 1 from public.persons p
    where p.user_id = auth.uid() and (
      exists (select 1 from public.patrol_members pm where pm.org_id = org and pm.person_id = p.id and pm.end_date is null
              and pm.role in ('patrol_leader','assistant_patrol_leader'))
      or exists (select 1 from public.leadership_positions lp where lp.org_id = org and lp.person_id = p.id
              and (lp.end_date is null or lp.end_date >= current_date)
              and lp.title in ('Senior Patrol Leader','Assistant Senior Patrol Leader','Patrol Leader','Assistant Patrol Leader'))));
$$;
grant execute on function public.is_plc_member(uuid) to authenticated;

create table if not exists public.plc_meetings (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  meeting_date date not null,
  agenda       text,
  notes        text,
  created_by   uuid references public.persons(id) on delete set null,
  created_at   timestamptz not null default now()
);
alter table public.plc_meetings enable row level security;
create policy "plc_meetings: members" on public.plc_meetings for all
  using (public.is_plc_member(org_id)) with check (public.is_plc_member(org_id));

create table if not exists public.plc_actions (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  meeting_id  uuid references public.plc_meetings(id) on delete set null,
  text        text not null,
  owner_id    uuid references public.persons(id) on delete set null,
  due_date    date,
  done_at     timestamptz,
  created_by  uuid references public.persons(id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table public.plc_actions enable row level security;
create policy "plc_actions: members" on public.plc_actions for all
  using (public.is_plc_member(org_id)) with check (public.is_plc_member(org_id));

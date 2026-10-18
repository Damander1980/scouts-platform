-- ============================================================
-- Advancement: ranks + merit badges, per-scout tracking
-- Requirement text is a SHORT SUMMARY, not official wording.
-- Leaders verify against the current Scouts BSA Requirements book.
-- ============================================================

create table public.advancement_items (
  id             uuid primary key default uuid_generate_v4(),
  kind           text not null check (kind in ('rank','badge')),
  code           text unique not null,
  name           text not null,
  eagle_required boolean not null default false,
  eagle_group    text,
  sort           integer not null default 0
);
alter table public.advancement_items enable row level security;
create policy "adv_items: anyone reads" on public.advancement_items for select using (true);

create table public.advancement_requirements (
  id            uuid primary key default uuid_generate_v4(),
  item_id       uuid not null references public.advancement_items(id) on delete cascade,
  number        text not null,
  text          text not null,
  sort          integer not null default 0,
  needs_signoff boolean not null default true
);
alter table public.advancement_requirements enable row level security;
create policy "adv_reqs: anyone reads" on public.advancement_requirements for select using (true);
create index idx_adv_reqs_item on public.advancement_requirements (item_id, sort);

create table public.scout_advancement (
  id           uuid primary key default uuid_generate_v4(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  person_id    uuid not null references public.persons(id) on delete cascade,
  item_id      uuid not null references public.advancement_items(id) on delete cascade,
  status       text not null default 'in_progress' check (status in ('assigned','in_progress','completed')),
  assigned_by  uuid references public.persons(id) on delete set null,
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  unique (person_id, item_id)
);
alter table public.scout_advancement enable row level security;
create index idx_scout_adv_person on public.scout_advancement (person_id);

create table public.requirement_progress (
  id             uuid primary key default uuid_generate_v4(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  person_id      uuid not null references public.persons(id) on delete cascade,
  requirement_id uuid not null references public.advancement_requirements(id) on delete cascade,
  completed_at   timestamptz,
  approved_by    uuid references public.persons(id) on delete set null,
  approved_at    timestamptz,
  unique (person_id, requirement_id)
);
alter table public.requirement_progress enable row level security;
create index idx_req_progress_person on public.requirement_progress (person_id);

create or replace function public.is_own_person(pid uuid)
returns boolean language sql security definer as $$
  select exists (select 1 from public.persons where id = pid and user_id = auth.uid());
$$;

create policy "scout_adv: org view" on public.scout_advancement
  for select using (public.is_org_member(org_id));
create policy "scout_adv: own or leader insert" on public.scout_advancement
  for insert with check (public.is_org_member(org_id) and (public.is_own_person(person_id) or public.is_org_leader(org_id)));
create policy "scout_adv: own or leader update" on public.scout_advancement
  for update using (public.is_own_person(person_id) or public.is_org_leader(org_id));
create policy "scout_adv: leader delete" on public.scout_advancement
  for delete using (public.is_org_leader(org_id) or public.is_own_person(person_id));

create policy "req_progress: org view" on public.requirement_progress
  for select using (public.is_org_member(org_id));
create policy "req_progress: own or leader insert" on public.requirement_progress
  for insert with check (public.is_org_member(org_id) and (public.is_own_person(person_id) or public.is_org_leader(org_id)));
create policy "req_progress: own or leader update" on public.requirement_progress
  for update using (public.is_own_person(person_id) or public.is_org_leader(org_id));

-- Only leaders can sign off, and nobody but a leader can undo a sign-off.
create or replace function public.guard_signoff()
returns trigger language plpgsql security definer as $$
begin
  if (tg_op = 'INSERT' and new.approved_by is not null)
     or (tg_op = 'UPDATE' and (new.approved_by is distinct from old.approved_by
                               or (old.approved_by is not null and new.completed_at is distinct from old.completed_at))) then
    if not public.is_org_leader(new.org_id) then
      raise exception 'Only a unit leader can sign off requirements';
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_guard_signoff before insert or update on public.requirement_progress
  for each row execute function public.guard_signoff();

-- Same rule for marking a whole badge/rank completed.
create or replace function public.guard_adv_complete()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status <> 'completed') then
    if not public.is_org_leader(new.org_id) then
      raise exception 'Only a unit leader can mark advancement completed';
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_guard_adv_complete before insert or update on public.scout_advancement
  for each row execute function public.guard_adv_complete();

-- 0007: Merit badge counselors. A counselor is approved for specific badges and
-- may sign off requirements (and mark the badge earned) only for those badges.
-- Ranks and Cub adventures stay leader-only.

alter table public.memberships drop constraint if exists memberships_role_check;
alter table public.memberships add constraint memberships_role_check check (role in (
  'scoutmaster','assistant_scoutmaster','committee_chair','committee_member','treasurer',
  'advancement_chair','chartered_org_rep','parent_guardian','scout','den_leader',
  'cubmaster','crew_advisor','skipper','merit_badge_counselor'
));

create table public.merit_badge_counselors (
  org_id     uuid not null references public.organizations(id) on delete cascade,
  person_id  uuid not null references public.persons(id) on delete cascade,
  item_id    uuid not null references public.advancement_items(id) on delete cascade,
  added_by   uuid references public.persons(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (org_id, person_id, item_id)
);
alter table public.merit_badge_counselors enable row level security;
create policy "mbc: org view" on public.merit_badge_counselors
  for select using (public.is_org_member(org_id));
create policy "mbc: leaders manage" on public.merit_badge_counselors
  for all using (public.is_org_leader(org_id)) with check (public.is_org_leader(org_id));

create or replace function public.can_counsel(org uuid, item uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.merit_badge_counselors c
    join public.persons p on p.id = c.person_id
    join public.memberships m on m.person_id = p.id and m.org_id = c.org_id and m.status = 'active'
    where c.org_id = org and c.item_id = item and p.user_id = auth.uid()
  );
$$;

create or replace function public.can_sign_requirement(org uuid, req uuid)
returns boolean language sql stable security definer as $$
  select public.is_org_leader(org)
      or exists (
        select 1 from public.advancement_requirements r
        join public.advancement_items i on i.id = r.item_id
        where r.id = req and i.kind = 'badge' and public.can_counsel(org, i.id)
      );
$$;

drop policy if exists "req_progress: own or leader insert" on public.requirement_progress;
drop policy if exists "req_progress: own or leader update" on public.requirement_progress;
create policy "req_progress: own, leader, or counselor insert" on public.requirement_progress
  for insert with check (public.is_org_member(org_id) and (
    public.is_own_person(person_id) or public.can_sign_requirement(org_id, requirement_id)));
create policy "req_progress: own, leader, or counselor update" on public.requirement_progress
  for update using (public.is_own_person(person_id) or public.can_sign_requirement(org_id, requirement_id));

drop policy if exists "scout_adv: own or leader update" on public.scout_advancement;
create policy "scout_adv: own, leader, or counselor update" on public.scout_advancement
  for update using (public.is_own_person(person_id) or public.is_org_leader(org_id) or public.can_counsel(org_id, item_id));

create or replace function public.guard_signoff()
returns trigger language plpgsql security definer as $$
begin
  if (tg_op = 'INSERT' and new.approved_by is not null)
     or (tg_op = 'UPDATE' and (new.approved_by is distinct from old.approved_by
                               or (old.approved_by is not null and new.completed_at is distinct from old.completed_at))) then
    if not public.can_sign_requirement(new.org_id, new.requirement_id) then
      raise exception 'Only a unit leader or this badge''s counselor can sign off this requirement';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.guard_adv_complete()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status <> 'completed') then
    if not (public.is_org_leader(new.org_id) or public.can_counsel(new.org_id, new.item_id)) then
      raise exception 'Only a unit leader or this badge''s counselor can mark it completed';
    end if;
  end if;
  return new;
end;
$$;

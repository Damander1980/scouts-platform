-- Recharter helper: one checklist per unit per charter year.
-- Per-person readiness (registration, YPT, member ID) is computed from memberships;
-- this table only stores the unit-level checklist ticks.

create table if not exists public.recharters (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  charter_year integer not null,
  due_on      date,
  items       jsonb not null default '{}',   -- { key: { done: bool, at: timestamptz, by: uuid } }
  notes       text,
  submitted_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (org_id, charter_year)
);
alter table public.recharters enable row level security;

create policy "recharters: leaders view" on public.recharters for select
  using (public.is_org_leader(org_id) or public.has_perm(org_id, 'members.manage') or public.has_perm(org_id, 'money.manage'));
create policy "recharters: manage" on public.recharters for all
  using (public.is_org_admin(org_id) or public.has_perm(org_id, 'members.manage') or public.has_perm(org_id, 'money.manage'))
  with check (public.is_org_admin(org_id) or public.has_perm(org_id, 'members.manage') or public.has_perm(org_id, 'money.manage'));

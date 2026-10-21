-- Eagle Scout service project tracker (SPEC phase 4). Follows the Eagle Scout Service Project
-- Workbook's order: proposal approvals (unit leader, committee, beneficiary, council), the project,
-- the final report, the Eagle application and the board of review. Dates are recorded by leaders;
-- the official record stays with the council and Scoutbook.

create table if not exists public.eagle_projects (
  id                      uuid primary key default gen_random_uuid(),
  org_id                  uuid not null references public.organizations(id) on delete cascade,
  person_id               uuid not null references public.persons(id) on delete cascade,
  title                   text not null,
  beneficiary             text,
  coach_id                uuid references public.persons(id) on delete set null,
  proposal_unit_leader_at date,
  proposal_committee_at   date,
  proposal_beneficiary_at date,
  proposal_council_at     date,
  work_started_at         date,
  work_finished_at        date,
  hours                   numeric,
  final_report_at         date,
  application_at          date,
  board_at                date,
  board_passed            boolean,
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (org_id, person_id)
);
alter table public.eagle_projects enable row level security;

create policy "eagle_projects: leaders manage" on public.eagle_projects for all
  using (public.is_org_leader(org_id)) with check (public.is_org_leader(org_id));
-- The Scout and their parents can follow along.
create policy "eagle_projects: own family view" on public.eagle_projects for select
  using (public.can_act_for(person_id));

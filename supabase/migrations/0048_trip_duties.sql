-- Patrol duty rosters on trip plans (SPEC: patrols plan meals, grocery lists and duty rosters).
-- Rows: { id, patrol, meal, text (job), who (Scout's name) }.
alter table public.trip_plans add column if not exists duties jsonb not null default '[]';

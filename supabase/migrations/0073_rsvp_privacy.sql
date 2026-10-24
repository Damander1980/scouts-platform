-- Sign-ups: two holes found in review (2026-10-23).
-- 1) Families and leaders could write rsvps rows directly, skipping set_rsvp: a family could mark a Scout
--    "going" with no charge, past the cap or the deadline, or after the event. All changes now go through
--    set_rsvp / decide_scout_rsvp / rsvp_promote (security definer); the table is read-only to the app.
-- 2) Any member of the unit could read every family's allergy notes, sign-up notes and answers. Who is
--    going stays visible to the unit; those three columns now come only through rsvp_private(), for the
--    family itself and the event's leaders.
drop policy if exists "rsvps: family manage" on public.rsvps;
drop policy if exists "rsvps: leaders manage" on public.rsvps;
drop policy if exists "rsvps: family view" on public.rsvps;
create policy "rsvps: family view" on public.rsvps for select using (public.can_act_for(person_id));

revoke select, insert, update, delete on public.rsvps from anon, authenticated;
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ') into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'rsvps' and column_name not in ('notes', 'dietary', 'answers');
  execute format('grant select (%s) on public.rsvps to authenticated', cols);
end $$;

create or replace function public.rsvp_private(p_org uuid, p_event_ids uuid[], p_person_ids uuid[])
returns table (event_id uuid, person_id uuid, notes text, dietary text, answers jsonb, rsvp_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.event_id, r.person_id, r.notes, r.dietary, r.answers, r.rsvp_at
  from public.rsvps r join public.events e on e.id = r.event_id
  where (p_org is not null or p_event_ids is not null or p_person_ids is not null)
    and (p_org is null or e.org_id = p_org)
    and (p_event_ids is null or r.event_id = any(p_event_ids))
    and (p_person_ids is null or r.person_id = any(p_person_ids))
    and (public.can_act_for(r.person_id) or public.is_org_leader(e.org_id))
  order by r.rsvp_at desc;
$$;
grant execute on function public.rsvp_private(uuid, uuid[], uuid[]) to authenticated;

-- Eagle projects and PLC action items may only name people (and meetings) from their own unit; a
-- leader of another unit could otherwise attach a made-up project to a Troop 999 Scout.
drop policy if exists "eagle_projects: leaders manage" on public.eagle_projects;
create policy "eagle_projects: leaders manage" on public.eagle_projects for all
  using (public.is_org_leader(org_id))
  with check (public.is_org_leader(org_id) and public.person_in_org(person_id, org_id)
    and (coach_id is null or public.person_in_org(coach_id, org_id)));

drop policy if exists "plc_actions: members add" on public.plc_actions;
drop policy if exists "plc_actions: members edit" on public.plc_actions;
create policy "plc_actions: members add" on public.plc_actions for insert with check (public.is_plc_member(org_id)
  and (owner_id is null or public.person_in_org(owner_id, org_id))
  and (meeting_id is null or exists (select 1 from public.plc_meetings m where m.id = meeting_id and m.org_id = plc_actions.org_id)));
create policy "plc_actions: members edit" on public.plc_actions for update using (public.is_plc_member(org_id)) with check (public.is_plc_member(org_id)
  and (owner_id is null or public.person_in_org(owner_id, org_id))
  and (meeting_id is null or exists (select 1 from public.plc_meetings m where m.id = meeting_id and m.org_id = plc_actions.org_id)));

-- Internal helpers: used only inside other database functions, never by the app. Callable by anyone
-- signed in, they revealed any person's family id and unit.
revoke execute on function public.person_household_in(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.rsvp_unit(uuid, uuid) from public, anon, authenticated;

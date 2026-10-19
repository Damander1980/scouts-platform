-- 0027: the household_members policy queried household_members itself (infinite recursion).
-- Membership checks go through security-definer helpers instead.

create or replace function public.in_household(hid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.household_members hm join public.persons p on p.id = hm.person_id
                 where hm.household_id = hid and p.user_id = auth.uid());
$$;

create or replace function public.is_household_guardian(hid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.household_members hm join public.persons p on p.id = hm.person_id
                 where hm.household_id = hid and hm.is_guardian and p.user_id = auth.uid());
$$;

create or replace function public.leader_of_person(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships m where m.person_id = pid and public.is_org_leader(m.org_id));
$$;

drop policy if exists "hh_members: family and leaders view" on public.household_members;
create policy "hh_members: family and leaders view" on public.household_members for select using (
  public.in_household(household_id) or public.leader_of_person(person_id));

drop policy if exists "households: members view" on public.households;
drop policy if exists "households: guardians update" on public.households;
create policy "households: members view" on public.households for select using (public.in_household(id));
create policy "households: guardians update" on public.households for update using (public.is_household_guardian(id));

-- The original roster policy joined persons to itself (recursion). The org roster policy in 0008 replaces it.
drop policy if exists "persons: org members view" on public.persons;

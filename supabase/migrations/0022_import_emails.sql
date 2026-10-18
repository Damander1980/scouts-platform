-- 0022: roster import keeps adults' contact emails.

create or replace function public.import_roster(p_org uuid, p_file text, p_rows jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  r jsonb; bid uuid; hid uuid; pid uuid; patid uuid; key text;
  homes jsonb := '{}'; persons_made uuid[] := '{}'; homes_made uuid[] := '{}'; patrols_made uuid[] := '{}'; n int := 0;
  ptype text; prole text;
begin
  if not public.is_org_admin(p_org) then raise exception 'Only unit admins can import'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    if coalesce(trim(r->>'first'), '') = '' or coalesce(trim(r->>'last'), '') = '' then continue; end if;
    ptype := case when lower(coalesce(r->>'type', 'youth')) in ('adult','parent','leader','a') then 'adult' else 'youth' end;
    prole := coalesce(nullif(r->>'role', ''), case when ptype = 'youth' then 'scout' else 'parent_guardian' end);
    if prole not in ('scoutmaster','assistant_scoutmaster','committee_chair','committee_member','treasurer','advancement_chair',
                     'chartered_org_rep','parent_guardian','scout','den_leader','cubmaster','crew_advisor','skipper','merit_badge_counselor') then
      prole := case when ptype = 'youth' then 'scout' else 'parent_guardian' end;
    end if;

    -- Skip people already on the roster with the same name and birthday.
    select p.id into pid from public.persons p join public.memberships m on m.person_id = p.id and m.org_id = p_org
      where lower(p.first_name) = lower(trim(r->>'first')) and lower(p.last_name) = lower(trim(r->>'last'))
        and (p.birthdate is not distinct from nullif(r->>'birthdate', '')::date) limit 1;
    if pid is not null then continue; end if;

    key := lower(coalesce(nullif(trim(r->>'household'), ''), trim(r->>'last')));
    hid := (homes->>key)::uuid;
    if hid is null then
      insert into public.households (name, org_id) values (initcap(trim(r->>'last')) || ' family', p_org) returning id into hid;
      homes := homes || jsonb_build_object(key, hid);
      homes_made := homes_made || hid;
    end if;

    insert into public.persons (first_name, last_name, type, birthdate, email)
    values (trim(r->>'first'), trim(r->>'last'), ptype, nullif(r->>'birthdate', '')::date,
            case when ptype = 'adult' then nullif(lower(trim(r->>'email')), '') end) returning id into pid;
    persons_made := persons_made || pid;
    insert into public.household_members (household_id, person_id, relation, is_guardian)
    values (hid, pid, case when ptype = 'youth' then 'scout' else 'parent' end, ptype = 'adult');
    insert into public.memberships (org_id, person_id, role, status) values (p_org, pid, prole, 'active');

    if coalesce(trim(r->>'patrol'), '') <> '' then
      select id into patid from public.patrols where org_id = p_org and lower(name) = lower(trim(r->>'patrol')) and active limit 1;
      if patid is null then
        insert into public.patrols (org_id, name) values (p_org, trim(r->>'patrol')) returning id into patid;
        patrols_made := patrols_made || patid;
      end if;
      insert into public.patrol_members (org_id, patrol_id, person_id) values (p_org, patid, pid);
    end if;
    n := n + 1;
  end loop;

  insert into public.import_batches (org_id, kind, file_name, row_count, created_by, created_ids)
  values (p_org, 'roster', p_file, n, public.my_person_id(),
          jsonb_build_object('persons', to_jsonb(persons_made), 'households', to_jsonb(homes_made), 'patrols', to_jsonb(patrols_made)))
  returning id into bid;
  return bid;
end;
$$;

-- Starting a troop sets up its standard positions automatically; logging each one (about 20 rows of
-- "position insert") buried the real entries in the activity log. Seeding is now marked and not logged.
create or replace function public.seed_positions_on_org()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.seeding_positions', 'on', true);
  perform public.seed_unit_positions(new.id);
  perform set_config('app.seeding_positions', 'off', true);
  return new;
end;
$$;

create or replace function public.audit_positions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Deleting a whole unit cascades here; nothing to audit against a unit that is gone.
  if not exists (select 1 from public.organizations where id = coalesce(new.org_id, old.org_id)) then
    return coalesce(new, old);
  end if;
  if tg_table_name = 'unit_positions' and coalesce(current_setting('app.seeding_positions', true), '') = 'on' then
    return coalesce(new, old);
  end if;
  if tg_table_name = 'unit_positions' then
    insert into public.audit_log (org_id, actor_id, action, target_type, target_id, payload)
    values (coalesce(new.org_id, old.org_id), public.my_person_id(), 'position.' || lower(tg_op), 'position',
            coalesce(new.id, old.id),
            jsonb_build_object('title', coalesce(new.title, old.title), 'from', old.permissions, 'to', new.permissions));
  else
    insert into public.audit_log (org_id, actor_id, action, target_type, target_id, payload)
    values (coalesce(new.org_id, old.org_id), public.my_person_id(),
            case when tg_op = 'DELETE' then 'position.removed' else 'position.assigned' end, 'person',
            coalesce(new.person_id, old.person_id), jsonb_build_object('position', coalesce(new.position_id, old.position_id)));
  end if;
  return coalesce(new, old);
end;
$$;

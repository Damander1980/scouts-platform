-- Hardening: every security definer function runs with a fixed search_path, so no object placed in
-- another schema can stand in for a table or function it calls (Supabase linter:
-- function_search_path_mutable). Covers the older functions written without one.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  loop
    execute format('alter function %s set search_path = public', f.sig);
  end loop;
end;
$$;

-- What a family gets back for canceling, shown before they confirm. Now only for someone you can act
-- for (or a leader), and through the right family account for linked-unit guests (same as set_rsvp).
create or replace function public.refund_preview(p_event uuid, p_person uuid)
returns int language plpgsql stable security definer set search_path = public as $$
declare e record; hid uuid; net int; pay_org uuid;
begin
  select * into e from public.events where id = p_event;
  if e is null then return 0; end if;
  pay_org := coalesce(public.rsvp_unit(p_event, p_person), e.org_id);
  if not (public.can_act_for(p_person) or public.is_org_leader(e.org_id) or public.is_org_leader(pay_org)) then return 0; end if;
  hid := coalesce(public.person_household_in(p_person, pay_org), public.person_household(p_person));
  select coalesce(sum(amount_cents), 0) into net from public.ledger_entries
    where event_id = p_event and household_id = hid and person_id = p_person;
  if net <= 0 then return 0; end if;
  if now() < coalesce(e.rsvp_deadline, e.start_at) then return net; end if;
  return case e.refund_rule when 'full' then net when 'partial' then net / 2 else 0 end;
end;
$$;

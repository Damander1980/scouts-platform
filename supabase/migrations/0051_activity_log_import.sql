-- Historical activity log (camping nights, hiking miles, service hours) imported from Scoutbook's
-- activity log export, so a troop that switches keeps each Scout's totals. New activity still comes
-- from event attendance; these rows only hold the past.

create table if not exists public.activity_log_entries (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  person_id  uuid not null references public.persons(id) on delete cascade,
  kind       text not null check (kind in ('camping','hiking','service')),
  amount     numeric not null check (amount >= 0),
  on_date    date,
  note       text,
  created_at timestamptz not null default now()
);
alter table public.activity_log_entries enable row level security;
create policy "activity_log: leaders manage" on public.activity_log_entries for all
  using (public.is_org_leader(org_id)) with check (public.is_org_leader(org_id));
create policy "activity_log: own family view" on public.activity_log_entries for select
  using (public.can_act_for(person_id));

alter table public.import_batches drop constraint if exists import_batches_kind_check;
alter table public.import_batches add constraint import_batches_kind_check check (kind in ('roster','advancement','balances','events','activity'));

-- rows: [{first,last,kind,amount,date,note}]; kind is camping|hiking|service (nights, miles, hours).
create or replace function public.import_activity(p_org uuid, p_file text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb; pid uuid; made uuid[] := '{}'; matched int := 0; skipped int := 0; nid uuid; bid uuid; k text;
begin
  if not public.is_org_admin(p_org) then raise exception 'Only unit admins can import'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    k := lower(coalesce(r->>'kind', ''));
    k := case when k like 'camp%' then 'camping' when k like 'hik%' then 'hiking' when k like 'serv%' then 'service' else null end;
    select p.id into pid from public.persons p join public.memberships m on m.person_id = p.id and m.org_id = p_org
      where lower(p.first_name) = lower(trim(r->>'first')) and lower(p.last_name) = lower(trim(r->>'last')) limit 1;
    if pid is null or k is null or coalesce(r->>'amount', '') !~ '^[0-9]+(\.[0-9]+)?$' then skipped := skipped + 1; continue; end if;
    insert into public.activity_log_entries (org_id, person_id, kind, amount, on_date, note)
    values (p_org, pid, k, (r->>'amount')::numeric, nullif(r->>'date', '')::date, nullif(r->>'note', ''))
    returning id into nid;
    made := made || nid; matched := matched + 1;
  end loop;
  insert into public.import_batches (org_id, kind, file_name, row_count, created_ids, created_by)
  values (p_org, 'activity', p_file, matched, jsonb_build_object('activity', to_jsonb(made)), public.my_person_id())
  returning id into bid;
  return jsonb_build_object('matched', matched, 'skipped', skipped, 'batch', bid);
end;
$$;
grant execute on function public.import_activity(uuid, text, jsonb) to authenticated;

-- Same as 0015's undo_import, plus activity imports.
create or replace function public.undo_import(p_batch uuid)
returns void language plpgsql security definer set search_path = public as $$
declare b record;
begin
  select * into b from public.import_batches where id = p_batch;
  if b is null or not public.is_org_admin(b.org_id) then raise exception 'Not allowed'; end if;
  if b.undone_at is not null then raise exception 'Already undone'; end if;
  if b.kind = 'roster' then
    delete from public.persons where id in (select (jsonb_array_elements_text(b.created_ids->'persons'))::uuid) and user_id is null;
    delete from public.households h where h.id in (select (jsonb_array_elements_text(b.created_ids->'households'))::uuid)
      and not exists (select 1 from public.household_members hm where hm.household_id = h.id);
    delete from public.patrols where id in (select (jsonb_array_elements_text(b.created_ids->'patrols'))::uuid);
  elsif b.kind = 'advancement' then
    delete from public.requirement_progress where id in (select (jsonb_array_elements_text(b.created_ids->'progress'))::uuid);
    delete from public.scout_advancement where id in (select (jsonb_array_elements_text(b.created_ids->'advancement'))::uuid);
  elsif b.kind = 'activity' then
    delete from public.activity_log_entries where id in (select (jsonb_array_elements_text(b.created_ids->'activity'))::uuid);
  end if;
  update public.import_batches set undone_at = now() where id = p_batch;
end;
$$;

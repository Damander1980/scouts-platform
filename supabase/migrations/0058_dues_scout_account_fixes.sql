-- Dues and Scout-account fixes.
-- * Charges and credits went to person_household(), which for a Scout with two families (or a family in
--   two units) may be a household outside this unit; now the household in this unit is used.
-- * Dues adjustments counted every "Dues adjustment" credit for the person since the plan was made,
--   across plans and units; they're now tied to their plan.
-- * dues_status listed every parent on an adult-dues plan, though charge_dues skips parents and Scouts.
-- * apply_scout_account: two quick clicks could overdraw a Scout's account (no lock), the credit could
--   exceed what the family owes, and the Scout had to be in the unit.

create or replace function public.apply_scout_account(p_org uuid, p_scout uuid, p_amount int)
returns void language plpgsql security definer set search_path = public as $$
declare bal int; hid uuid; owed int;
begin
  if not (public.is_guardian_of(p_scout) or public.is_treasurer(p_org)) then raise exception 'Not allowed'; end if;
  if not public.person_in_org(p_scout, p_org) then raise exception 'That Scout is not in this unit'; end if;
  perform pg_advisory_xact_lock(hashtext('scout_account:' || p_scout::text));
  select coalesce(sum(amount_cents), 0) into bal from public.scout_account_entries where org_id = p_org and scout_id = p_scout;
  if p_amount <= 0 or p_amount > bal then raise exception 'Not enough in the Scout account'; end if;
  hid := coalesce(public.person_household_in(p_scout, p_org), public.person_household(p_scout));
  select coalesce(sum(amount_cents), 0) into owed from public.ledger_entries where household_id = hid and org_id = p_org;
  if p_amount > owed then raise exception 'That is more than the family owes'; end if;
  insert into public.scout_account_entries (org_id, scout_id, amount_cents, description, created_by)
  values (p_org, p_scout, -p_amount, 'Applied to family balance', public.my_person_id());
  insert into public.ledger_entries (org_id, household_id, amount_cents, type, description, manual, method, person_id, created_by)
  values (p_org, hid, -p_amount, 'credit', 'Scout account applied', false, 'scout_account', p_scout, public.my_person_id());
end;
$$;

create or replace function public.charge_dues(p_plan uuid)
returns int language plpgsql security definer set search_path = public as $$
declare pl record; r record; n int := 0; hid uuid;
begin
  select * into pl from public.dues_plans where id = p_plan;
  if not found or not public.is_treasurer(pl.org_id) then raise exception 'Only the treasurer or an admin can charge dues'; end if;
  for r in
    select m.person_id, p.type from public.memberships m join public.persons p on p.id = m.person_id
    where m.org_id = pl.org_id and m.status = 'active'
      and (pl.applies_to = 'all' or (pl.applies_to = 'youth' and p.type = 'youth') or (pl.applies_to = 'adults' and p.type = 'adult' and m.role not in ('parent_guardian','scout')))
  loop
    hid := coalesce(public.person_household_in(r.person_id, pl.org_id), public.person_household(r.person_id));
    if hid is null or pl.amount_cents = 0 then continue; end if;
    begin
      insert into public.ledger_entries (org_id, household_id, amount_cents, type, description, person_id, dues_plan_id, created_by)
      values (pl.org_id, hid, pl.amount_cents, 'charge', pl.name, r.person_id, p_plan, public.my_person_id());
      n := n + 1;
    exception when unique_violation then null;
    end;
  end loop;
  insert into public.audit_log (org_id, actor_id, action, target_type, target_id, payload)
  values (pl.org_id, public.my_person_id(), 'dues.charged', 'dues_plan', p_plan, jsonb_build_object('charged', n));
  return n;
end;
$$;

create or replace function public.adjust_dues(p_plan uuid, p_person uuid, p_credit_cents int, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare pl record; hid uuid;
begin
  select * into pl from public.dues_plans where id = p_plan;
  if not found or not public.is_treasurer(pl.org_id) then raise exception 'Only the treasurer or an admin can adjust dues'; end if;
  if not public.person_in_org(p_person, pl.org_id) then raise exception 'That person is not in this unit'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Give a reason (scholarship, hardship, second Scout, etc.)'; end if;
  if p_credit_cents <= 0 then raise exception 'Enter a positive amount'; end if;
  hid := coalesce(public.person_household_in(p_person, pl.org_id), public.person_household(p_person));
  insert into public.ledger_entries (org_id, household_id, amount_cents, type, description, person_id, manual, method, created_by, dues_plan_id)
  values (pl.org_id, hid, -p_credit_cents, 'credit', 'Dues adjustment: ' || p_reason, p_person, true, 'adjustment', public.my_person_id(), p_plan);
end;
$$;

-- Old adjustments without a plan: attach each to the latest plan of its unit created before it.
alter table public.ledger_entries disable rule ledger_no_update;
update public.ledger_entries l set dues_plan_id = (
    select d.id from public.dues_plans d where d.org_id = l.org_id and d.created_at <= l.created_at order by d.created_at desc limit 1)
  where l.type = 'credit' and l.description like 'Dues adjustment:%' and l.dues_plan_id is null;
alter table public.ledger_entries enable rule ledger_no_update;

create or replace function public.dues_status(p_plan uuid)
returns table (person_id uuid, first_name text, last_name text, household_id uuid, household_name text,
               charged_cents bigint, adjusted_cents bigint, family_balance_cents bigint)
language sql stable security definer set search_path = public as $$
  with pl as (select * from public.dues_plans where id = p_plan)
  select p.id, p.first_name, p.last_name, h.id, h.name,
    coalesce((select sum(l.amount_cents) from public.ledger_entries l where l.dues_plan_id = p_plan and l.person_id = p.id and l.type = 'charge'), 0),
    coalesce((select -sum(l.amount_cents) from public.ledger_entries l where l.dues_plan_id = p_plan and l.person_id = p.id and l.type = 'credit'), 0),
    coalesce((select sum(l.amount_cents) from public.ledger_entries l where l.household_id = h.id and l.org_id = (select org_id from pl)), 0)
  from pl
  join public.memberships m on m.org_id = pl.org_id and m.status = 'active'
  join public.persons p on p.id = m.person_id and (pl.applies_to = 'all' or (pl.applies_to = 'youth' and p.type = 'youth')
    or (pl.applies_to = 'adults' and p.type = 'adult' and m.role not in ('parent_guardian','scout')))
  left join public.households h on h.id = coalesce(public.person_household_in(p.id, pl.org_id), public.person_household(p.id))
  where public.has_perm(pl.org_id, 'money.view')
  order by p.last_name, p.first_name;
$$;

-- Paying a reimbursement: mark it paid and book the expense in one step, once. Two clicks (or two
-- treasurers) used to book the expense twice, and a failed second write left "paid" with no expense.
create or replace function public.pay_expense_request(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from public.expense_requests where id = p_id for update;
  if r is null or not public.is_treasurer(r.org_id) then raise exception 'Only the treasurer or an admin can pay this'; end if;
  if r.status = 'paid' then return; end if;
  if r.status not in ('approved', 'second_approval') then raise exception 'Approve the request before paying it'; end if;
  update public.expense_requests set status = 'paid', paid_at = now() where id = p_id;
  insert into public.unit_transactions (org_id, kind, category, amount_cents, description, event_id)
  values (r.org_id, 'expense', r.category, r.amount_cents, 'Reimbursement: ' || r.description, r.event_id);
end;
$$;
grant execute on function public.pay_expense_request(uuid) to authenticated;

-- 0032: yearly dues / enrollment. A plan has an amount and due date. Charging it posts one ledger
-- charge per enrolled Scout (to that Scout's family), exactly once per Scout per plan.
-- Dues are always paid either in person (no card fee) or online (card fee added; the unit never absorbs it).

create table if not exists public.dues_plans (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  school_year text not null,
  amount_cents integer not null check (amount_cents >= 0),
  due_on      date,
  applies_to  text not null default 'youth' check (applies_to in ('youth','adults','all')),
  created_at  timestamptz not null default now(),
  created_by  uuid references public.persons(id) on delete set null
);
alter table public.dues_plans enable row level security;
create policy "dues_plans: leaders view" on public.dues_plans for select using (public.is_org_leader(org_id));
create policy "dues_plans: treasurer manage" on public.dues_plans for all using (public.is_treasurer(org_id)) with check (public.is_treasurer(org_id));

alter table public.ledger_entries add column if not exists dues_plan_id uuid references public.dues_plans(id) on delete set null;
create unique index if not exists uq_dues_once on public.ledger_entries (dues_plan_id, person_id) where dues_plan_id is not null and type = 'charge';

-- Charge a plan to everyone it applies to who hasn't been charged yet. Safe to run again after new Scouts join.
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
    hid := public.person_household(r.person_id);
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

-- Waive or reduce one Scout's dues (a credit that references the plan). Needs a reason.
create or replace function public.adjust_dues(p_plan uuid, p_person uuid, p_credit_cents int, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare pl record; hid uuid;
begin
  select * into pl from public.dues_plans where id = p_plan;
  if not found or not public.is_treasurer(pl.org_id) then raise exception 'Only the treasurer or an admin can adjust dues'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Give a reason (scholarship, hardship, second Scout, etc.)'; end if;
  if p_credit_cents <= 0 then raise exception 'Enter a positive amount'; end if;
  hid := public.person_household(p_person);
  insert into public.ledger_entries (org_id, household_id, amount_cents, type, description, person_id, manual, method, created_by)
  values (pl.org_id, hid, -p_credit_cents, 'credit', 'Dues adjustment: ' || p_reason, p_person, true, 'adjustment', public.my_person_id());
end;
$$;

-- Per-Scout dues status for a plan: charged, adjusted, and whether the family is paid up.
create or replace function public.dues_status(p_plan uuid)
returns table (person_id uuid, first_name text, last_name text, household_id uuid, household_name text,
               charged_cents bigint, adjusted_cents bigint, family_balance_cents bigint)
language sql stable security definer as $$
  with pl as (select * from public.dues_plans where id = p_plan)
  select p.id, p.first_name, p.last_name, h.id, h.name,
    coalesce((select sum(l.amount_cents) from public.ledger_entries l where l.dues_plan_id = p_plan and l.person_id = p.id and l.type = 'charge'), 0),
    coalesce((select -sum(l.amount_cents) from public.ledger_entries l where l.person_id = p.id and l.type = 'credit' and l.description like 'Dues adjustment:%'
              and l.created_at >= (select created_at from pl)), 0),
    coalesce((select sum(l.amount_cents) from public.ledger_entries l where l.household_id = h.id and l.org_id = (select org_id from pl)), 0)
  from pl
  join public.memberships m on m.org_id = pl.org_id and m.status = 'active'
  join public.persons p on p.id = m.person_id and (pl.applies_to = 'all' or (pl.applies_to = 'youth' and p.type = 'youth') or (pl.applies_to = 'adults' and p.type = 'adult'))
  left join public.households h on h.id = public.person_household(p.id)
  where public.is_treasurer(pl.org_id) or public.is_org_leader(pl.org_id)
  order by p.last_name, p.first_name;
$$;

-- Cards always include the processing fee: no unit ever loses money to Stripe.
update public.organizations set settings = settings - 'fee_policy' where settings ? 'fee_policy';

-- 0016: everyday unit operations — documents, gear, money planning, donations, fundraising,
-- reimbursements, shifts, polls, rank awards, trip plans, website, consent, deletion requests.

-- ---------- documents ----------
create table if not exists public.documents (
  id         uuid primary key default uuid_generate_v4(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  title      text not null,
  url        text not null,
  category   text,
  visibility text not null default 'members' check (visibility in ('public','members','leaders')),
  created_by uuid references public.persons(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.documents enable row level security;
create policy "docs: view" on public.documents for select using (
  visibility = 'public' or (visibility = 'members' and public.is_org_member(org_id)) or public.is_org_leader(org_id));
create policy "docs: leaders manage" on public.documents for all using (public.is_org_leader(org_id)) with check (public.is_org_leader(org_id));

-- ---------- equipment ----------
create table if not exists public.equipment (
  id         uuid primary key default uuid_generate_v4(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  name       text not null,
  category   text,
  tag        text,
  condition  text not null default 'good' check (condition in ('good','needs_repair','retired')),
  notes      text,
  created_at timestamptz not null default now()
);
alter table public.equipment enable row level security;
create policy "equip: org view" on public.equipment for select using (public.is_org_member(org_id));
create policy "equip: leaders manage" on public.equipment for all using (public.is_org_leader(org_id)) with check (public.is_org_leader(org_id));

create table if not exists public.checkouts (
  id           uuid primary key default uuid_generate_v4(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  person_id    uuid not null references public.persons(id) on delete cascade,
  event_id     uuid references public.events(id) on delete set null,
  out_at       timestamptz not null default now(),
  due_at       timestamptz,
  returned_at  timestamptz,
  note         text
);
alter table public.checkouts enable row level security;
create policy "checkouts: org view" on public.checkouts for select using (public.is_org_member(org_id));
create policy "checkouts: leaders manage" on public.checkouts for all using (public.is_org_leader(org_id)) with check (public.is_org_leader(org_id));

-- ---------- budgets ----------
create table if not exists public.budgets (
  id           uuid primary key default uuid_generate_v4(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  fiscal_year  text not null,
  starts_on    date not null,
  ends_on      date not null,
  approved_at  timestamptz,
  approved_by  uuid references public.persons(id) on delete set null,
  alert_pct    integer not null default 80,
  unique (org_id, fiscal_year)
);
alter table public.budgets enable row level security;
create policy "budgets: leaders view" on public.budgets for select using (public.is_org_leader(org_id));
create policy "budgets: treasurer manage" on public.budgets for all using (public.is_treasurer(org_id)) with check (public.is_treasurer(org_id));

create table if not exists public.budget_lines (
  id         uuid primary key default uuid_generate_v4(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  budget_id  uuid not null references public.budgets(id) on delete cascade,
  kind       text not null check (kind in ('income','expense')),
  category   text not null,
  planned_cents integer not null default 0,
  notes      text
);
alter table public.budget_lines enable row level security;
create policy "budget_lines: leaders view" on public.budget_lines for select using (public.is_org_leader(org_id));
create policy "budget_lines: treasurer manage" on public.budget_lines for all using (public.is_treasurer(org_id)) with check (public.is_treasurer(org_id));

-- Unit income/expense recorded against budget categories (not family balances).
create table if not exists public.unit_transactions (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  kind        text not null check (kind in ('income','expense')),
  category    text not null,
  amount_cents integer not null check (amount_cents > 0),
  description text,
  event_id    uuid references public.events(id) on delete set null,
  occurred_on date not null default current_date,
  source      text not null default 'manual',
  stripe_id   text,
  created_by  uuid references public.persons(id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table public.unit_transactions enable row level security;
create policy "unit_tx: leaders view" on public.unit_transactions for select using (public.is_org_leader(org_id));
create policy "unit_tx: treasurer insert" on public.unit_transactions for insert with check (public.is_treasurer(org_id));
create rule unit_tx_no_update as on update to public.unit_transactions do instead nothing;
create rule unit_tx_no_delete as on delete to public.unit_transactions do instead nothing;

-- ---------- fundraising goals, donations, fundraisers ----------
create table if not exists public.fundraising_goals (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  title       text not null,
  description text,
  target_cents integer not null,
  deadline    date,
  photo_url   text,
  is_public   boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.fundraising_goals enable row level security;
create policy "goals: view" on public.fundraising_goals for select using (is_public or public.is_org_member(org_id));
create policy "goals: treasurer manage" on public.fundraising_goals for all using (public.is_treasurer(org_id)) with check (public.is_treasurer(org_id));

create table if not exists public.donation_campaigns (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  slug        text unique not null default substr(md5(random()::text), 1, 10),
  title       text not null,
  description text,
  goal_id     uuid references public.fundraising_goals(id) on delete set null,
  scout_id    uuid references public.persons(id) on delete set null,
  target_cents integer,
  receipt_text text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.donation_campaigns enable row level security;
create policy "campaigns: public view" on public.donation_campaigns for select using (active or public.is_org_member(org_id));
create policy "campaigns: treasurer manage" on public.donation_campaigns for all using (public.is_treasurer(org_id)) with check (public.is_treasurer(org_id));

create table if not exists public.donations (
  id           uuid primary key default uuid_generate_v4(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  campaign_id  uuid references public.donation_campaigns(id) on delete set null,
  amount_cents integer not null,
  fee_cents    integer not null default 0,
  donor_name   text,
  donor_email  text,
  source       text,
  stripe_id    text unique,
  created_at   timestamptz not null default now()
);
alter table public.donations enable row level security;
create policy "donations: treasurer view" on public.donations for select using (public.is_treasurer(org_id));

create table if not exists public.fundraisers (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  goal_id     uuid references public.fundraising_goals(id) on delete set null,
  name        text not null,
  starts_on   date, ends_on date,
  target_cents integer,
  scout_share_pct integer not null default 0 check (scout_share_pct between 0 and 100),
  created_at  timestamptz not null default now()
);
alter table public.fundraisers enable row level security;
create policy "fundraisers: org view" on public.fundraisers for select using (public.is_org_member(org_id));
create policy "fundraisers: treasurer manage" on public.fundraisers for all using (public.is_treasurer(org_id)) with check (public.is_treasurer(org_id));

create table if not exists public.fundraiser_sales (
  id           uuid primary key default uuid_generate_v4(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  fundraiser_id uuid not null references public.fundraisers(id) on delete cascade,
  scout_id     uuid references public.persons(id) on delete set null,
  amount_cents integer not null,
  customer     text,
  note         text,
  created_by   uuid references public.persons(id) on delete set null,
  created_at   timestamptz not null default now()
);
alter table public.fundraiser_sales enable row level security;
create policy "sales: view" on public.fundraiser_sales for select using (public.is_org_leader(org_id) or public.can_act_for(scout_id));
create policy "sales: record" on public.fundraiser_sales for insert with check (public.is_org_leader(org_id) or public.can_act_for(scout_id));

-- Scout account: each Scout's share of fundraiser sales, spendable on their event costs.
create table if not exists public.scout_account_entries (
  id           uuid primary key default uuid_generate_v4(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  scout_id     uuid not null references public.persons(id) on delete cascade,
  amount_cents integer not null,
  description  text,
  source_id    uuid,
  created_by   uuid references public.persons(id) on delete set null,
  created_at   timestamptz not null default now()
);
alter table public.scout_account_entries enable row level security;
create policy "scout_acct: view" on public.scout_account_entries for select using (public.is_treasurer(org_id) or public.can_act_for(scout_id));
create policy "scout_acct: treasurer insert" on public.scout_account_entries for insert with check (public.is_treasurer(org_id));
create rule scout_acct_no_update as on update to public.scout_account_entries do instead nothing;
create rule scout_acct_no_delete as on delete to public.scout_account_entries do instead nothing;

create or replace function public.credit_scout_share()
returns trigger language plpgsql security definer as $$
declare pct int;
begin
  select scout_share_pct into pct from public.fundraisers where id = new.fundraiser_id;
  if new.scout_id is not null and coalesce(pct, 0) > 0 then
    insert into public.scout_account_entries (org_id, scout_id, amount_cents, description, source_id, created_by)
    values (new.org_id, new.scout_id, round(new.amount_cents * pct / 100.0), 'Fundraiser earnings', new.id, new.created_by);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_credit_scout_share on public.fundraiser_sales;
create trigger trg_credit_scout_share after insert on public.fundraiser_sales for each row execute function public.credit_scout_share();

-- Parent applies a Scout's account toward the family balance.
create or replace function public.apply_scout_account(p_org uuid, p_scout uuid, p_amount int)
returns void language plpgsql security definer set search_path = public as $$
declare bal int; hid uuid;
begin
  if not (public.is_guardian_of(p_scout) or public.is_treasurer(p_org)) then raise exception 'Not allowed'; end if;
  select coalesce(sum(amount_cents), 0) into bal from public.scout_account_entries where org_id = p_org and scout_id = p_scout;
  if p_amount <= 0 or p_amount > bal then raise exception 'Not enough in the Scout account'; end if;
  hid := public.person_household(p_scout);
  insert into public.scout_account_entries (org_id, scout_id, amount_cents, description, created_by)
  values (p_org, p_scout, -p_amount, 'Applied to family balance', public.my_person_id());
  insert into public.ledger_entries (org_id, household_id, amount_cents, type, description, manual, method, person_id, created_by)
  values (p_org, hid, -p_amount, 'credit', 'Scout account applied', false, 'scout_account', p_scout, public.my_person_id());
end;
$$;

-- ---------- reimbursements ----------
create table if not exists public.expense_requests (
  id           uuid primary key default uuid_generate_v4(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid not null references public.persons(id) on delete cascade,
  event_id     uuid references public.events(id) on delete set null,
  category     text not null default 'Camping',
  amount_cents integer not null check (amount_cents > 0),
  description  text not null,
  receipt_path text,
  status       text not null default 'submitted' check (status in ('submitted','approved','second_approval','paid','rejected')),
  approved_by  uuid references public.persons(id) on delete set null,
  second_approved_by uuid references public.persons(id) on delete set null,
  paid_at      timestamptz,
  note         text,
  created_at   timestamptz not null default now()
);
alter table public.expense_requests enable row level security;
create policy "expenses: own or treasurer view" on public.expense_requests for select using (public.is_own_person(requested_by) or public.is_treasurer(org_id));
create policy "expenses: leaders submit" on public.expense_requests for insert with check (public.is_own_person(requested_by) and public.is_org_member(org_id));
create policy "expenses: treasurer update" on public.expense_requests for update using (public.is_treasurer(org_id));

alter table public.organizations add column if not exists second_approval_cents integer not null default 50000;

-- ---------- shifts ----------
create table if not exists public.shifts (
  id         uuid primary key default uuid_generate_v4(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  title      text not null,
  location   text,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  slots      integer not null default 2,
  fundraiser_id uuid references public.fundraisers(id) on delete set null
);
alter table public.shifts enable row level security;
create policy "shifts: org view" on public.shifts for select using (public.is_org_member(org_id));
create policy "shifts: leaders manage" on public.shifts for all using (public.is_org_leader(org_id)) with check (public.is_org_leader(org_id));

create table if not exists public.shift_signups (
  shift_id  uuid not null references public.shifts(id) on delete cascade,
  person_id uuid not null references public.persons(id) on delete cascade,
  org_id    uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (shift_id, person_id)
);
alter table public.shift_signups enable row level security;
create policy "shift_signups: org view" on public.shift_signups for select using (public.is_org_member(org_id));
create policy "shift_signups: family manage" on public.shift_signups for all using (public.can_act_for(person_id) or public.is_org_leader(org_id))
  with check (public.can_act_for(person_id) or public.is_org_leader(org_id));

-- ---------- polls ----------
create table if not exists public.polls (
  id         uuid primary key default uuid_generate_v4(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  question   text not null,
  options    jsonb not null,
  audience   text not null default 'all' check (audience in ('all','youth','adults','plc')),
  closes_at  timestamptz,
  created_by uuid references public.persons(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.polls enable row level security;
create policy "polls: org view" on public.polls for select using (public.is_org_member(org_id));
create policy "polls: create" on public.polls for insert with check (public.is_org_leader(org_id) or exists (
  select 1 from public.patrol_members pm where pm.org_id = polls.org_id and public.is_own_person(pm.person_id) and pm.end_date is null and pm.role = 'patrol_leader'));

create table if not exists public.poll_votes (
  poll_id   uuid not null references public.polls(id) on delete cascade,
  person_id uuid not null references public.persons(id) on delete cascade,
  org_id    uuid not null references public.organizations(id) on delete cascade,
  choice    integer not null,
  created_at timestamptz not null default now(),
  primary key (poll_id, person_id)
);
alter table public.poll_votes enable row level security;
create policy "votes: org view" on public.poll_votes for select using (public.is_org_member(org_id));
create policy "votes: own" on public.poll_votes for insert with check (public.is_own_person(person_id) and public.is_org_member(org_id));

-- ---------- rank awards: Scoutmaster conference and board of review ----------
create table if not exists public.rank_awards (
  id           uuid primary key default uuid_generate_v4(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  person_id    uuid not null references public.persons(id) on delete cascade,
  item_id      uuid not null references public.advancement_items(id) on delete cascade,
  conference_at date,
  conference_by uuid references public.persons(id) on delete set null,
  board_at     date,
  board_result text check (board_result in ('passed','not_yet')),
  awarded_at   date,
  presented_at date,
  purchased    boolean not null default false,
  notes        text,
  unique (person_id, item_id)
);
alter table public.rank_awards enable row level security;
create policy "rank_awards: org view" on public.rank_awards for select using (public.is_org_member(org_id));
create policy "rank_awards: leaders manage" on public.rank_awards for all using (public.is_org_leader(org_id)) with check (public.is_org_leader(org_id));

-- ---------- trip plans ----------
create table if not exists public.trip_plans (
  event_id    uuid primary key references public.events(id) on delete cascade,
  org_id      uuid not null references public.organizations(id) on delete cascade,
  itinerary   jsonb not null default '[]',
  costs       jsonb not null default '[]',
  meals       jsonb not null default '[]',
  packing     jsonb not null default '[]',
  tasks       jsonb not null default '[]',
  permits     jsonb not null default '[]',
  updated_at  timestamptz not null default now()
);
alter table public.trip_plans enable row level security;
create policy "trip_plans: org view" on public.trip_plans for select using (public.is_org_member(org_id));
create policy "trip_plans: leaders manage" on public.trip_plans for all using (public.is_org_leader(org_id)) with check (public.is_org_leader(org_id));

create table if not exists public.driver_info (
  person_id     uuid primary key references public.persons(id) on delete cascade,
  vehicle       text,
  seatbelts     integer,
  license_ok_on date,
  insurance_ok_on date
);
alter table public.driver_info enable row level security;
create policy "driver: own" on public.driver_info for all using (public.is_own_person(person_id)) with check (public.is_own_person(person_id));
create policy "driver: leaders view" on public.driver_info for select using (exists (
  select 1 from public.memberships m where m.person_id = driver_info.person_id and public.is_org_leader(m.org_id)));

-- ---------- website ----------
create table if not exists public.site_pages (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  slug        text not null,
  title       text not null,
  blocks      jsonb not null default '[]',
  visibility  text not null default 'public' check (visibility in ('public','members')),
  published   boolean not null default false,
  sort        integer not null default 0,
  updated_by  uuid references public.persons(id) on delete set null,
  updated_at  timestamptz not null default now(),
  unique (org_id, slug)
);
alter table public.site_pages enable row level security;
create policy "site: public view" on public.site_pages for select using ((published and visibility = 'public') or public.is_org_member(org_id));
create policy "site: editors manage" on public.site_pages for all using (public.is_org_leader(org_id)) with check (public.is_org_leader(org_id));

create table if not exists public.site_page_history (
  id         uuid primary key default uuid_generate_v4(),
  page_id    uuid not null references public.site_pages(id) on delete cascade,
  org_id     uuid not null references public.organizations(id) on delete cascade,
  blocks     jsonb not null,
  title      text,
  saved_by   uuid references public.persons(id) on delete set null,
  saved_at   timestamptz not null default now()
);
alter table public.site_page_history enable row level security;
create policy "site_hist: leaders" on public.site_page_history for select using (public.is_org_leader(org_id));
create or replace function public.snapshot_page() returns trigger language plpgsql security definer as $$
begin
  insert into public.site_page_history (page_id, org_id, blocks, title, saved_by) values (old.id, old.org_id, old.blocks, old.title, public.my_person_id());
  return new;
end; $$;
drop trigger if exists trg_snapshot_page on public.site_pages;
create trigger trg_snapshot_page before update on public.site_pages for each row execute function public.snapshot_page();

-- Public troop page reads only safe fields.
create or replace function public.public_unit(p_slug text)
returns table (id uuid, name text, type text, unit_number text, city text, state text, slug text, join_code text, settings jsonb)
language sql stable security definer as $$
  select id, name, type, unit_number, city, state, slug, join_code,
         settings - 'internal' from public.organizations where slug = lower(p_slug);
$$;
grant execute on function public.public_unit(text) to anon;

create or replace function public.public_leaders(p_org uuid)
returns table (role text, first_name text, last_name text)
language sql stable security definer as $$
  select m.role, p.first_name, p.last_name from public.memberships m join public.persons p on p.id = m.person_id
  where m.org_id = p_org and m.status = 'active' and coalesce((m.other_training->>'list_publicly')::boolean, false)
    and m.role in ('scoutmaster','assistant_scoutmaster','committee_chair','cubmaster','crew_advisor','skipper','den_leader','treasurer');
$$;
grant execute on function public.public_leaders(uuid) to anon;

create or replace function public.public_events(p_org uuid)
returns table (id uuid, title text, start_at timestamptz, end_at timestamptz, location text, kind text)
language sql stable security definer as $$
  select id, title, start_at, end_at, location, kind from public.events
  where org_id = p_org and visibility = 'public' and not canceled and start_at > now() order by start_at limit 10;
$$;
grant execute on function public.public_events(uuid) to anon;

-- ---------- consent and privacy ----------
alter table public.persons add column if not exists photo_consent boolean;
alter table public.persons add column if not exists photo_consent_at timestamptz;

create table if not exists public.deletion_requests (
  id           uuid primary key default uuid_generate_v4(),
  person_id    uuid not null references public.persons(id) on delete cascade,
  requested_by uuid not null references public.persons(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending','confirmed','paused','completed','canceled')),
  pause_reason text,
  execute_after timestamptz not null default now() + interval '14 days',
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.deletion_requests enable row level security;
create policy "deletion: requester view" on public.deletion_requests for select using (public.is_own_person(requested_by));
create policy "deletion: leaders view" on public.deletion_requests for select using (exists (
  select 1 from public.memberships m where m.person_id = deletion_requests.person_id and public.is_org_admin(m.org_id)));

create or replace function public.request_deletion(p_person uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  if not public.is_guardian_of(p_person) and not public.is_own_person(p_person) then
    raise exception 'Only a parent or guardian can request deletion';
  end if;
  insert into public.deletion_requests (person_id, requested_by) values (p_person, public.my_person_id()) returning id into rid;
  insert into public.audit_log (org_id, actor_id, action, target_type, target_id)
  select m.org_id, public.my_person_id(), 'deletion.requested', 'person', p_person from public.memberships m where m.person_id = p_person;
  return rid;
end;
$$;

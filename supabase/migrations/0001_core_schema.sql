-- ============================================================
-- ScoutPlatform core schema
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- USERS (mirrors auth.users, extended profile)
-- ============================================================
create table public.users (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text unique not null,
  phone        text,
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.users enable row level security;
create policy "users: own row" on public.users
  for all using (auth.uid() = id);

-- ============================================================
-- PERSONS  (real people — may or may not have a login)
-- Adults and youth are separate rows. A user_id links the
-- person to a login when they have one.
-- ============================================================
create table public.persons (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid references public.users(id) on delete set null,
  first_name text not null,
  last_name  text not null,
  birthdate  date,
  type       text not null check (type in ('adult','youth')),
  created_at timestamptz not null default now()
);
alter table public.persons enable row level security;

-- ============================================================
-- ORGANIZATIONS  (troops, packs, crews, etc.)
-- ============================================================
create table public.organizations (
  id                   uuid primary key default uuid_generate_v4(),
  name                 text not null,
  type                 text not null,             -- 'scouts_bsa','cubs','venturing','sea','trail_life','ahg','other'
  unit_number          text,
  city                 text,
  state                text,
  slug                 text unique not null,
  join_code            text unique not null default substr(md5(random()::text), 1, 8),
  settings             jsonb not null default '{}',
  designated_leaders   jsonb not null default '[]',   -- array of person_id (two-deep rule)
  stripe_account_id    text,                          -- Stripe Connect
  subscription_status  text not null default 'trial', -- 'trial','active','past_due','canceled'
  created_at           timestamptz not null default now()
);
alter table public.organizations enable row level security;

-- ============================================================
-- HOUSEHOLDS  (billing unit — one family)
-- ============================================================
create table public.households (
  id               uuid primary key default uuid_generate_v4(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  billing_contact  uuid references public.persons(id) on delete set null,
  created_at       timestamptz not null default now()
);
alter table public.households enable row level security;

-- ============================================================
-- HOUSEHOLD_MEMBERS  (person ↔ household)
-- ============================================================
create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  person_id    uuid not null references public.persons(id) on delete cascade,
  relation     text,           -- 'parent','guardian','scout','sibling'
  is_guardian  boolean not null default false,
  primary key (household_id, person_id)
);
alter table public.household_members enable row level security;

-- ============================================================
-- MEMBERSHIPS  (person ↔ org, with role)
-- ============================================================
create table public.memberships (
  id         uuid primary key default uuid_generate_v4(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  person_id  uuid not null references public.persons(id) on delete cascade,
  role       text not null check (role in (
               'scoutmaster','assistant_scoutmaster','committee_chair',
               'committee_member','treasurer','advancement_chair',
               'chartered_org_rep','parent_guardian','scout','den_leader',
               'cubmaster','crew_advisor','skipper'
             )),
  status     text not null default 'active' check (status in ('active','inactive','pending')),
  ypt_expires date,       -- Youth Protection Training expiry (adults)
  joined_at  timestamptz not null default now(),
  unique (org_id, person_id)
);
alter table public.memberships enable row level security;

-- ============================================================
-- EVENTS
-- ============================================================
create table public.events (
  id           uuid primary key default uuid_generate_v4(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  title        text not null,
  description  text,
  location     text,
  start_at     timestamptz not null,
  end_at       timestamptz,
  cost_cents   integer not null default 0,   -- per-person cost in cents
  cap          integer,                       -- max attendees (null = unlimited)
  rsvp_deadline timestamptz,
  refund_rule  text not null default 'none' check (refund_rule in ('none','full','partial')),
  created_by   uuid references public.persons(id) on delete set null,
  created_at   timestamptz not null default now()
);
alter table public.events enable row level security;

-- ============================================================
-- RSVPs
-- ============================================================
create table public.rsvps (
  id                   uuid primary key default uuid_generate_v4(),
  event_id             uuid not null references public.events(id) on delete cascade,
  person_id            uuid not null references public.persons(id) on delete cascade,
  status               text not null default 'going' check (status in ('going','not_going','waitlisted')),
  driver_seats         integer not null default 0,
  notes                text,
  rsvp_approval_status text not null default 'approved' check (rsvp_approval_status in ('pending','approved','denied')),
  rsvp_at              timestamptz not null default now(),
  unique (event_id, person_id)
);
alter table public.rsvps enable row level security;

-- ============================================================
-- LEDGER_ENTRIES  (append-only — never UPDATE or DELETE)
-- ============================================================
create table public.ledger_entries (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  household_id    uuid not null references public.households(id) on delete cascade,
  amount_cents    integer not null,   -- positive = charge, negative = credit/refund
  type            text not null check (type in ('charge','payment','credit','refund')),
  description     text,
  event_id        uuid references public.events(id) on delete set null,
  stripe_pi_id    text,   -- Stripe PaymentIntent id
  stripe_refund_id text,
  manual          boolean not null default false,
  created_by      uuid references public.persons(id) on delete set null,
  created_at      timestamptz not null default now()
);
alter table public.ledger_entries enable row level security;
-- Prevent any UPDATE or DELETE on ledger
create rule ledger_no_update as on update to public.ledger_entries do instead nothing;
create rule ledger_no_delete as on delete to public.ledger_entries do instead nothing;

-- ============================================================
-- FORMS  (track status & expiry — no file storage)
-- ============================================================
create table public.forms (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  person_id   uuid not null references public.persons(id) on delete cascade,
  type        text not null,   -- 'health_ab','health_c','permission','background_check'
  signed_by   uuid references public.persons(id) on delete set null,
  signed_at   timestamptz,
  expires_at  timestamptz,
  notes       text,
  created_at  timestamptz not null default now()
);
alter table public.forms enable row level security;

-- ============================================================
-- AUDIT_LOG  (append-only — who did what)
-- ============================================================
create table public.audit_log (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid references public.organizations(id) on delete set null,
  actor_id    uuid references public.persons(id) on delete set null,
  action      text not null,
  target_type text,
  target_id   uuid,
  payload     jsonb,
  created_at  timestamptz not null default now()
);
alter table public.audit_log enable row level security;
create rule audit_no_update as on update to public.audit_log do instead nothing;
create rule audit_no_delete as on delete to public.audit_log do instead nothing;

-- ============================================================
-- MESSAGE_LOG  (immutable — nobody edits or deletes messages)
-- ============================================================
create table public.message_log (
  id           uuid primary key default uuid_generate_v4(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  sender_id    uuid references public.persons(id) on delete set null,
  subject      text,
  body         text not null,
  channel      text not null check (channel in ('email','sms','in_app')),
  event_id     uuid references public.events(id) on delete set null,
  created_at   timestamptz not null default now()
);
alter table public.message_log enable row level security;
create rule message_no_update as on update to public.message_log do instead nothing;
create rule message_no_delete as on delete to public.message_log do instead nothing;

create table public.message_recipients (
  message_id  uuid not null references public.message_log(id) on delete cascade,
  person_id   uuid not null references public.persons(id) on delete cascade,
  delivered   boolean not null default false,
  delivered_at timestamptz,
  primary key (message_id, person_id)
);
alter table public.message_recipients enable row level security;

-- ============================================================
-- RLS POLICIES — org isolation
-- Members can see org data for orgs they belong to.
-- Leaders (scoutmaster/asst/committee) can see all org data.
-- ============================================================

-- Helper: is the auth user a member of a given org?
create or replace function public.is_org_member(org uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.memberships m
    join public.persons p on p.id = m.person_id
    where m.org_id = org and p.user_id = auth.uid() and m.status = 'active'
  );
$$;

-- Helper: is the auth user a leader in a given org?
create or replace function public.is_org_leader(org uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.memberships m
    join public.persons p on p.id = m.person_id
    where m.org_id = org
      and p.user_id = auth.uid()
      and m.status = 'active'
      and m.role in (
        'scoutmaster','assistant_scoutmaster','committee_chair',
        'committee_member','treasurer','advancement_chair',
        'chartered_org_rep','den_leader','cubmaster','crew_advisor','skipper'
      )
  );
$$;

-- Organizations: members can view their own org
create policy "orgs: members view" on public.organizations
  for select using (public.is_org_member(id));

-- Persons: visible within shared orgs
create policy "persons: org members view" on public.persons
  for select using (
    exists (
      select 1 from public.memberships m1
      join public.memberships m2 on m1.org_id = m2.org_id
      join public.persons p on p.id = m2.person_id
      where m1.person_id = persons.id
        and p.user_id = auth.uid()
        and m1.status = 'active'
        and m2.status = 'active'
    )
  );
create policy "persons: own row" on public.persons
  for all using (user_id = auth.uid());

-- Households: visible to members of same org
create policy "households: org members view" on public.households
  for select using (public.is_org_member(org_id));
create policy "households: leaders manage" on public.households
  for all using (public.is_org_leader(org_id));

-- Household members: follow household policy
create policy "hh_members: org members view" on public.household_members
  for select using (
    exists (
      select 1 from public.households h where h.id = household_id and public.is_org_member(h.org_id)
    )
  );

-- Memberships
create policy "memberships: org members view" on public.memberships
  for select using (public.is_org_member(org_id));
create policy "memberships: leaders manage" on public.memberships
  for all using (public.is_org_leader(org_id));

-- Events
create policy "events: org members view" on public.events
  for select using (public.is_org_member(org_id));
create policy "events: leaders manage" on public.events
  for all using (public.is_org_leader(org_id));

-- RSVPs: members can manage their own household's RSVPs; leaders see all
create policy "rsvps: own person" on public.rsvps
  for all using (
    exists (
      select 1 from public.persons p where p.id = person_id and p.user_id = auth.uid()
    )
  );
create policy "rsvps: leaders view" on public.rsvps
  for select using (
    exists (
      select 1 from public.events e where e.id = event_id and public.is_org_leader(e.org_id)
    )
  );

-- Ledger: household members view their own; leaders view all
create policy "ledger: own household" on public.ledger_entries
  for select using (
    exists (
      select 1 from public.household_members hm
      join public.persons p on p.id = hm.person_id
      where hm.household_id = ledger_entries.household_id and p.user_id = auth.uid()
    )
  );
create policy "ledger: leaders view" on public.ledger_entries
  for select using (public.is_org_leader(org_id));
create policy "ledger: leaders insert" on public.ledger_entries
  for insert with check (public.is_org_leader(org_id));

-- Forms: own person or leaders
create policy "forms: own person" on public.forms
  for select using (
    exists (select 1 from public.persons p where p.id = person_id and p.user_id = auth.uid())
  );
create policy "forms: leaders manage" on public.forms
  for all using (public.is_org_leader(org_id));

-- Audit log: leaders read only
create policy "audit: leaders read" on public.audit_log
  for select using (public.is_org_leader(org_id));
create policy "audit: service insert" on public.audit_log
  for insert with check (true);

-- Messages: org members view; leaders insert
create policy "messages: org members view" on public.message_log
  for select using (public.is_org_member(org_id));
create policy "messages: leaders send" on public.message_log
  for insert with check (public.is_org_leader(org_id));

create policy "msg_recipients: org members view" on public.message_recipients
  for select using (
    exists (
      select 1 from public.message_log ml where ml.id = message_id and public.is_org_member(ml.org_id)
    )
  );

-- ============================================================
-- Indexes
-- ============================================================
create index on public.memberships (org_id, person_id);
create index on public.memberships (person_id);
create index on public.events (org_id, start_at);
create index on public.rsvps (event_id);
create index on public.rsvps (person_id);
create index on public.ledger_entries (org_id, household_id);
create index on public.ledger_entries (household_id);
create index on public.forms (org_id, person_id);
create index on public.audit_log (org_id, created_at desc);
create index on public.message_log (org_id, created_at desc);

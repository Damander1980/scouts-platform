-- 0023: message_log is append-only, so delivery results live in their own table.
alter table public.message_log drop column if exists delivery;
create table if not exists public.message_deliveries (
  message_id uuid primary key references public.message_log(id) on delete cascade,
  delivered  integer not null default 0,
  skipped    integer not null default 0,
  full_email boolean not null default false,
  sent_at    timestamptz not null default now()
);
alter table public.message_deliveries enable row level security;
create policy "deliveries: sender or admins view" on public.message_deliveries for select using (
  exists (select 1 from public.message_log m where m.id = message_id and (public.is_own_person(m.sender_id) or public.is_org_admin(m.org_id))));

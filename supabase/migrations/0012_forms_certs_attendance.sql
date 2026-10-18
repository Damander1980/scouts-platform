-- 0012: form status (no documents stored), skill cards, attendance and activity credit,
-- leader compliance fields.

-- ---------- forms ----------
alter table public.forms add column if not exists exam_date date;
alter table public.forms add column if not exists marked_by uuid references public.persons(id) on delete set null;
create unique index if not exists uq_forms_person_type on public.forms (org_id, person_id, type);

drop policy if exists "forms: own person" on public.forms;
create policy "forms: family view" on public.forms for select using (public.can_act_for(person_id));

create or replace function public.is_designated(org uuid)
returns boolean language sql stable security definer as $$
  select exists (select 1 from public.memberships m join public.persons p on p.id = m.person_id
                 where m.org_id = org and p.user_id = auth.uid() and m.status = 'active' and (m.is_designated_leader or m.is_admin));
$$;

-- Health record parts: expire at the end of the 12th month after the exam date (Part C)
-- or after the date completed (A/B). Only designated leaders mark them received.
create or replace function public.mark_form(p_org uuid, p_person uuid, p_type text, p_date date, p_received boolean)
returns void language plpgsql security definer set search_path = public as $$
declare exp timestamptz;
begin
  if not public.is_designated(p_org) then raise exception 'Only designated leaders can record forms'; end if;
  if p_type not in ('health_ab','health_c','permission','other') then raise exception 'Unknown form type'; end if;
  if p_received then
    exp := (date_trunc('month', coalesce(p_date, current_date)) + interval '13 months' - interval '1 second');
    insert into public.forms (org_id, person_id, type, exam_date, signed_at, expires_at, status, marked_by)
    values (p_org, p_person, p_type, p_date, now(), exp, 'received', public.my_person_id())
    on conflict (org_id, person_id, type) do update set exam_date = excluded.exam_date, signed_at = now(),
      expires_at = excluded.expires_at, status = 'received', marked_by = excluded.marked_by;
  else
    delete from public.forms where org_id = p_org and person_id = p_person and type = p_type;
  end if;
  insert into public.audit_log (org_id, actor_id, action, target_type, target_id, payload)
  values (p_org, public.my_person_id(), 'form.' || case when p_received then 'received' else 'cleared' end, 'person', p_person,
          jsonb_build_object('type', p_type, 'date', p_date));
end;
$$;

-- Parents sign the troop's annual permission slip themselves.
create or replace function public.sign_permission(p_org uuid, p_person uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_guardian_of(p_person) then raise exception 'Only a parent or guardian can sign'; end if;
  insert into public.forms (org_id, person_id, type, signed_by, signed_at, expires_at, status)
  values (p_org, p_person, 'permission', public.my_person_id(), now(), now() + interval '1 year', 'received')
  on conflict (org_id, person_id, type) do update set signed_by = excluded.signed_by, signed_at = now(),
    expires_at = excluded.expires_at, status = 'received';
  insert into public.audit_log (org_id, actor_id, action, target_type, target_id)
  values (p_org, public.my_person_id(), 'form.permission_signed', 'person', p_person);
end;
$$;

-- ---------- certifications (Totin' Chip, Firem'n Chit, troop-specific) ----------
create table if not exists public.certifications (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid references public.organizations(id) on delete cascade,
  code        text not null,
  name        text not null,
  description text,
  renew_months integer,
  unique (org_id, code)
);
alter table public.certifications enable row level security;
create policy "certs: view" on public.certifications for select using (org_id is null or public.is_org_member(org_id));
create policy "certs: leaders manage" on public.certifications for all using (org_id is not null and public.is_org_leader(org_id))
  with check (org_id is not null and public.is_org_leader(org_id));

insert into public.certifications (org_id, code, name, description) values
  (null, 'totin_chip', 'Totin'' Chip', 'Right to carry and use woods tools: knife, ax, and saw.'),
  (null, 'firemn_chit', 'Firem''n Chit', 'Right to build and tend campfires and use stoves.'),
  (null, 'whittling_chip', 'Whittling Chip', 'Cub Scout pocketknife safety.'),
  (null, 'swim_test', 'BSA Swimmer Test', 'Swimmer classification for aquatics activities.'),
  (null, 'cpr', 'CPR / First Aid', 'Current CPR and first aid training.')
on conflict do nothing;

create table if not exists public.scout_certifications (
  id         uuid primary key default uuid_generate_v4(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  person_id  uuid not null references public.persons(id) on delete cascade,
  cert_id    uuid not null references public.certifications(id) on delete cascade,
  earned_at  date not null default current_date,
  expires_at date,
  signed_by  uuid references public.persons(id) on delete set null,
  status     text not null default 'active' check (status in ('active','suspended','revoked')),
  note       text,
  unique (org_id, person_id, cert_id)
);
alter table public.scout_certifications enable row level security;
create policy "scout_certs: org view" on public.scout_certifications for select using (public.is_org_member(org_id));
create policy "scout_certs: leaders manage" on public.scout_certifications for all using (public.is_org_leader(org_id)) with check (public.is_org_leader(org_id));

create or replace function public.audit_cert()
returns trigger language plpgsql security definer as $$
begin
  insert into public.audit_log (org_id, actor_id, action, target_type, target_id, payload)
  values (coalesce(new.org_id, old.org_id), public.my_person_id(), 'certification.' || lower(tg_op), 'person',
          coalesce(new.person_id, old.person_id),
          jsonb_build_object('cert', coalesce(new.cert_id, old.cert_id), 'status', new.status, 'note', new.note));
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_audit_cert on public.scout_certifications;
create trigger trg_audit_cert after insert or update or delete on public.scout_certifications
  for each row execute function public.audit_cert();

-- ---------- attendance and activity credit ----------
create table if not exists public.attendance (
  id         uuid primary key default uuid_generate_v4(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  event_id   uuid not null references public.events(id) on delete cascade,
  person_id  uuid not null references public.persons(id) on delete cascade,
  present    boolean not null default true,
  marked_by  uuid references public.persons(id) on delete set null,
  marked_at  timestamptz not null default now(),
  unique (event_id, person_id)
);
alter table public.attendance enable row level security;
create policy "attendance: org view" on public.attendance for select using (public.is_org_member(org_id));
create policy "attendance: leaders manage" on public.attendance for all using (public.is_org_leader(org_id)) with check (public.is_org_leader(org_id));

create or replace function public.audit_attendance()
returns trigger language plpgsql security definer as $$
begin
  insert into public.audit_log (org_id, actor_id, action, target_type, target_id, payload)
  values (coalesce(new.org_id, old.org_id), public.my_person_id(), 'attendance.' || lower(tg_op), 'event',
          coalesce(new.event_id, old.event_id), jsonb_build_object('person', coalesce(new.person_id, old.person_id), 'present', new.present));
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_audit_attendance on public.attendance;
create trigger trg_audit_attendance after insert or update or delete on public.attendance
  for each row execute function public.audit_attendance();

-- Credits are derived, never typed: nights, service hours and miles from attended events.
create or replace view public.activity_credits with (security_invoker = true) as
select a.org_id, a.person_id,
  coalesce(sum(e.overnight_nights) filter (where e.kind in ('campout','high_adventure','event')), 0) as nights_camped,
  coalesce(sum(e.service_hours), 0) as service_hours,
  coalesce(sum(e.miles) filter (where e.kind <> 'service'), 0) as miles,
  count(*) as events_attended
from public.attendance a join public.events e on e.id = a.event_id
where a.present and not e.canceled
group by a.org_id, a.person_id;

-- ---------- leader compliance ----------
alter table public.memberships add column if not exists registration_expires date;
alter table public.memberships add column if not exists other_training jsonb not null default '{}';
alter table public.memberships add column if not exists uniform_size text;

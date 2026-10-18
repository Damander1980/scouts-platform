-- 0024: unit website — settings, photo albums with consent, public contact form.

create policy "orgs: admins update" on public.organizations for update using (public.is_org_admin(id)) with check (public.is_org_admin(id));

create table if not exists public.albums (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  title       text not null,
  taken_on    date,
  event_id    uuid references public.events(id) on delete set null,
  visibility  text not null default 'members' check (visibility in ('public','members')),
  cover_path  text,
  created_at  timestamptz not null default now()
);
alter table public.albums enable row level security;
create policy "albums: view" on public.albums for select using (visibility = 'public' or public.is_org_member(org_id));
create policy "albums: leaders manage" on public.albums for all using (public.is_org_leader(org_id)) with check (public.is_org_leader(org_id));

create table if not exists public.photos (
  id         uuid primary key default uuid_generate_v4(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  album_id   uuid not null references public.albums(id) on delete cascade,
  path       text not null,
  caption    text,
  tagged     uuid[] not null default '{}',
  hidden     boolean not null default false,
  uploaded_by uuid references public.persons(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.photos enable row level security;
create policy "photos: members view" on public.photos for select using (public.is_org_member(org_id));
create policy "photos: leaders manage" on public.photos for all using (public.is_org_leader(org_id)) with check (public.is_org_leader(org_id));

-- Parents record photo consent for their own children.
create or replace function public.set_photo_consent(p_person uuid, p_consent boolean)
returns void language plpgsql security definer as $$
begin
  if not public.is_guardian_of(p_person) then raise exception 'Only a parent or guardian can set photo consent'; end if;
  update public.persons set photo_consent = p_consent, photo_consent_at = now() where id = p_person;
end;
$$;

create table if not exists public.contact_requests (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  to_person   uuid references public.persons(id) on delete set null,
  name        text not null,
  email       text not null,
  phone       text,
  message     text not null,
  handled     boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.contact_requests enable row level security;
create policy "contact: leaders view" on public.contact_requests for select using (public.is_org_leader(org_id));
create policy "contact: leaders update" on public.contact_requests for update using (public.is_org_leader(org_id));

create or replace function public.submit_contact(p_slug text, p_to uuid, p_name text, p_email text, p_phone text, p_message text)
returns void language plpgsql security definer as $$
declare oid uuid; recent int;
begin
  select id into oid from public.organizations where slug = lower(p_slug);
  if oid is null then raise exception 'Unit not found'; end if;
  if length(coalesce(p_message, '')) < 5 or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter your email and a message'; end if;
  select count(*) into recent from public.contact_requests where org_id = oid and lower(email) = lower(p_email) and created_at > now() - interval '1 hour';
  if recent >= 3 then raise exception 'Thanks, we already received your messages. A leader will reply soon.'; end if;
  insert into public.contact_requests (org_id, to_person, name, email, phone, message)
  values (oid, p_to, left(trim(p_name), 120), left(lower(trim(p_email)), 200), left(trim(p_phone), 40), left(trim(p_message), 4000));
end;
$$;
grant execute on function public.submit_contact(text, uuid, text, text, text, text) to anon;

-- Everything the public site needs in one call. Photos with any youth lacking parent consent are excluded.
create or replace function public.public_site(p_slug text)
returns jsonb language sql stable security definer as $$
  with o as (select * from public.organizations where slug = lower(p_slug))
  select jsonb_build_object(
    'org', (select jsonb_build_object('id', id, 'name', name, 'type', type, 'unit_number', unit_number, 'city', city, 'state', state, 'slug', slug, 'join_code', join_code, 'site', coalesce(settings->'site', '{}')) from o),
    'contacts', (select coalesce(jsonb_agg(jsonb_build_object('title', c->>'title', 'person_id', c->>'person_id', 'name', p.first_name || ' ' || p.last_name)), '[]')
                 from o, jsonb_array_elements(coalesce(o.settings->'site'->'contacts', '[]')) c
                 join public.persons p on p.id = (c->>'person_id')::uuid),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'start_at', e.start_at, 'end_at', e.end_at, 'kind', e.kind, 'deadline', e.rsvp_deadline, 'location', e.location) order by e.start_at), '[]')
               from o join public.events e on e.org_id = o.id
               where e.visibility = 'public' and not e.canceled and e.start_at > now() - interval '6 hours' and e.start_at < now() + interval '90 days'),
    'albums', (select coalesce(jsonb_agg(x order by x->>'taken_on' desc nulls last), '[]') from (
                 select jsonb_build_object('id', a.id, 'title', a.title, 'taken_on', a.taken_on,
                   'photos', (select coalesce(jsonb_agg(jsonb_build_object('path', ph.path, 'caption', ph.caption) order by ph.created_at), '[]')
                              from public.photos ph where ph.album_id = a.id and not ph.hidden
                                and not exists (select 1 from unnest(ph.tagged) t join public.persons tp on tp.id = t
                                                where tp.type = 'youth' and coalesce(tp.photo_consent, false) = false))) x
                 from o join public.albums a on a.org_id = o.id where a.visibility = 'public' order by a.taken_on desc nulls last limit 12) s)
  );
$$;
grant execute on function public.public_site(text) to anon;

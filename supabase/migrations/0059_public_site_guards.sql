-- Public site, photos and volunteer guards (anyone can start a unit and be its admin, so rows must
-- point only at things in their own unit).
-- * Photos: a photo's album must belong to the photo's unit; otherwise one unit could put images on
--   another troop's public page (and that troop couldn't remove them).
-- * public_site: contacts must be active ADULT members of the unit (no youth names to the public);
--   the join code is no longer published (the join page works from the slug); photos match album unit.
-- * submit_contact: a message can only be addressed to one of the unit's listed contacts.
-- * Shift sign-ups and poll votes must match the unit of the shift/poll; votes only while the poll is open.

drop policy if exists "photos: leaders manage" on public.photos;
create policy "photos: leaders manage" on public.photos for all
  using (public.is_org_leader(org_id) or public.has_perm(org_id, 'site.edit'))
  with check ((public.is_org_leader(org_id) or public.has_perm(org_id, 'site.edit'))
    and (album_id is null or exists (select 1 from public.albums a where a.id = album_id and a.org_id = photos.org_id)));

create or replace function public.public_site(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  with o as (select * from public.organizations where slug = lower(p_slug))
  select jsonb_build_object(
    'org', (select jsonb_build_object('id', id, 'name', name, 'type', type, 'unit_number', unit_number, 'city', city, 'state', state, 'slug', slug, 'site', coalesce(settings->'site', '{}')) from o),
    'contacts', (select coalesce(jsonb_agg(jsonb_build_object('title', c->>'title', 'person_id', c->>'person_id', 'name', p.first_name || ' ' || p.last_name)), '[]')
                 from o, jsonb_array_elements(coalesce(o.settings->'site'->'contacts', '[]')) c
                 join public.persons p on p.id::text = (c->>'person_id') and p.type = 'adult'
                 where exists (select 1 from public.memberships m where m.org_id = o.id and m.person_id = p.id and m.status = 'active')),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'start_at', e.start_at, 'end_at', e.end_at, 'kind', e.kind, 'deadline', e.rsvp_deadline, 'location', e.location) order by e.start_at), '[]')
               from o join public.events e on e.org_id = o.id
               where e.visibility = 'public' and not e.canceled and e.start_at > now() - interval '6 hours' and e.start_at < now() + interval '90 days'),
    'albums', (select coalesce(jsonb_agg(x order by x->>'taken_on' desc nulls last), '[]') from (
                 select jsonb_build_object('id', a.id, 'title', a.title, 'taken_on', a.taken_on,
                   'photos', (select coalesce(jsonb_agg(jsonb_build_object('path', ph.path, 'caption', ph.caption) order by ph.created_at), '[]')
                              from public.photos ph where ph.album_id = a.id and ph.org_id = a.org_id and not ph.hidden
                                and not exists (select 1 from unnest(ph.tagged) t join public.persons tp on tp.id = t
                                                where tp.type = 'youth' and coalesce(tp.photo_consent, false) = false))) x
                 from o join public.albums a on a.org_id = o.id where a.visibility = 'public' order by a.taken_on desc nulls last limit 12) s)
  );
$$;
grant execute on function public.public_site(text) to anon;

create or replace function public.submit_contact(p_slug text, p_to uuid, p_name text, p_email text, p_phone text, p_message text)
returns void language plpgsql security definer set search_path = public as $$
declare oid uuid; recent int; contacts jsonb;
begin
  select id, coalesce(settings->'site'->'contacts', '[]') into oid, contacts from public.organizations where slug = lower(p_slug);
  if oid is null then raise exception 'Unit not found'; end if;
  if length(coalesce(p_message, '')) < 5 or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter your email and a message'; end if;
  if p_to is not null and not exists (select 1 from jsonb_array_elements(contacts) c where c->>'person_id' = p_to::text) then
    p_to := null; -- not a listed contact: goes to the unit's leaders instead
  end if;
  select count(*) into recent from public.contact_requests where org_id = oid and lower(email) = lower(p_email) and created_at > now() - interval '1 hour';
  if recent >= 3 then raise exception 'Thanks, we already received your messages. A leader will reply soon.'; end if;
  insert into public.contact_requests (org_id, to_person, name, email, phone, message)
  values (oid, p_to, left(trim(p_name), 120), left(lower(trim(p_email)), 200), left(trim(p_phone), 40), left(trim(p_message), 4000));
end;
$$;

drop policy if exists "shift_signups: family manage" on public.shift_signups;
create policy "shift_signups: family manage" on public.shift_signups for all
  using (public.can_act_for(person_id) or public.is_org_leader(org_id) or public.has_perm(org_id, 'volunteer.manage'))
  with check ((public.can_act_for(person_id) or public.is_org_leader(org_id) or public.has_perm(org_id, 'volunteer.manage'))
    and exists (select 1 from public.shifts s where s.id = shift_id and s.org_id = shift_signups.org_id)
    and public.person_in_org(person_id, org_id));

drop policy if exists "votes: own" on public.poll_votes;
create policy "votes: own" on public.poll_votes for insert with check (
  public.is_own_person(person_id) and public.is_org_member(org_id)
  and exists (select 1 from public.polls p where p.id = poll_id and p.org_id = poll_votes.org_id and (p.closes_at is null or p.closes_at > now())));

-- Site uploads: images only (an SVG can carry script).
update storage.buckets set allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'] where id = 'site';

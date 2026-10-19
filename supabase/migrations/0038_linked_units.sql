-- Linked units (e.g. a boys' and a girls' troop, or a troop and its pack).
-- Phase 1 of linking: a shared calendar. An event marked share_linked shows on the
-- linked unit's calendar, read-only. Sign-ups and money stay with the host unit;
-- combined sign-ups across units are a later decision (whose ledger gets the charge).

create table if not exists public.unit_links (
  id           uuid primary key default gen_random_uuid(),
  requester_org uuid not null references public.organizations(id) on delete cascade,
  target_org   uuid not null references public.organizations(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending','accepted')),
  created_by   uuid references public.persons(id) on delete set null,
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  check (requester_org <> target_org)
);
create unique index if not exists unit_links_pair on public.unit_links (least(requester_org, target_org), greatest(requester_org, target_org));
alter table public.unit_links enable row level security;

create policy "unit_links: admins view" on public.unit_links for select
  using (public.is_org_admin(requester_org) or public.is_org_admin(target_org));
-- Either side's admin can remove a link; creating and accepting go through the functions below.
create policy "unit_links: admins delete" on public.unit_links for delete
  using (public.is_org_admin(requester_org) or public.is_org_admin(target_org));

alter table public.events add column if not exists share_linked boolean not null default false;

-- True when the caller is an active member of a unit that has an accepted link to `org`.
create or replace function public.is_linked_member(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.unit_links l
    join public.memberships m on m.org_id = case when l.requester_org = org then l.target_org else l.requester_org end
    join public.persons p on p.id = m.person_id
    where l.status = 'accepted' and (l.requester_org = org or l.target_org = org)
      and m.status = 'active' and p.user_id = auth.uid()
  );
$$;

create policy "events: linked units view" on public.events for select
  using (share_linked and public.is_linked_member(org_id));

-- Ask to link with another unit by its join code.
create or replace function public.request_unit_link(p_org uuid, p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare t uuid; tname text;
begin
  if not public.is_org_admin(p_org) then raise exception 'Only a unit admin can link units'; end if;
  select id, name into t, tname from public.organizations where join_code = lower(trim(p_code)) limit 1;
  if t is null then raise exception 'No unit has that join code'; end if;
  if t = p_org then raise exception 'That is your own unit'; end if;
  insert into public.unit_links (requester_org, target_org, created_by) values (p_org, t, public.my_person_id());
  return tname;
exception when unique_violation then
  raise exception 'These units are already linked or a request is waiting';
end;
$$;

create or replace function public.accept_unit_link(p_link uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.unit_links set status = 'accepted', accepted_at = now()
  where id = p_link and status = 'pending' and public.is_org_admin(target_org);
  if not found then raise exception 'Not allowed'; end if;
end;
$$;

-- Names of the linked units for the admin screen and calendar labels.
create or replace function public.linked_units(p_org uuid)
returns table (link_id uuid, org_id uuid, name text, status text, incoming boolean)
language sql stable security definer set search_path = public as $$
  select l.id, o.id, o.name, l.status, l.target_org = p_org
  from public.unit_links l
  join public.organizations o on o.id = case when l.requester_org = p_org then l.target_org else l.requester_org end
  where (l.requester_org = p_org or l.target_org = p_org)
    and public.is_org_member(p_org);
$$;

grant execute on function public.is_linked_member(uuid) to authenticated;
grant execute on function public.request_unit_link(uuid, text) to authenticated;
grant execute on function public.accept_unit_link(uuid) to authenticated;
grant execute on function public.linked_units(uuid) to authenticated;

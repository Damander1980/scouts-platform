-- 0013: calendar subscription feed. Calendar apps can't sign in, so the feed URL
-- carries a per-unit secret that admins can rotate.

alter table public.organizations add column if not exists calendar_token text not null default substr(md5(random()::text || clock_timestamp()::text), 1, 20);

create or replace function public.calendar_feed(p_org uuid, p_token text)
returns table (id uuid, title text, description text, location text, start_at timestamptz, end_at timestamptz, canceled boolean, org_name text)
language sql stable security definer as $$
  select e.id, e.title, e.description, e.location, e.start_at, e.end_at, e.canceled, o.name
  from public.events e join public.organizations o on o.id = e.org_id
  where o.id = p_org and o.calendar_token = p_token and e.start_at > now() - interval '60 days'
  order by e.start_at;
$$;
grant execute on function public.calendar_feed(uuid, text) to anon;

create or replace function public.org_calendar_token(p_org uuid)
returns text language sql stable security definer as $$
  select calendar_token from public.organizations where id = p_org and public.is_org_member(p_org);
$$;

create or replace function public.rotate_calendar_token(p_org uuid)
returns text language plpgsql security definer as $$
declare t text;
begin
  if not public.is_org_admin(p_org) then raise exception 'Not allowed'; end if;
  update public.organizations set calendar_token = substr(md5(random()::text || clock_timestamp()::text), 1, 20)
  where id = p_org returning calendar_token into t;
  return t;
end;
$$;

-- Claim codes and co-parent family codes make whoever enters them a guardian with access to a child's
-- records. They were short, came from random() (not a secure source), never expired, and could be guessed
-- without limit. Now: 12 characters from gen_random_uuid(), valid 14 days, at most 10 wrong tries an hour.
alter table public.claim_codes alter column code set default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
alter table public.household_invites alter column code set default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
alter table public.claim_codes add column if not exists expires_at timestamptz;
alter table public.household_invites add column if not exists expires_at timestamptz;
update public.claim_codes set expires_at = created_at + interval '14 days' where expires_at is null;
update public.household_invites set expires_at = created_at + interval '14 days' where expires_at is null;
alter table public.claim_codes alter column expires_at set default now() + interval '14 days';
alter table public.household_invites alter column expires_at set default now() + interval '14 days';

create table if not exists public.code_attempts (
  user_id uuid not null,
  at      timestamptz not null default now()
);
create index if not exists code_attempts_user_at on public.code_attempts (user_id, at);
alter table public.code_attempts enable row level security; -- no policies: only the functions below touch it

create or replace function public.code_tries_left()
returns boolean language sql stable security definer set search_path = public as $$
  select (select count(*) from public.code_attempts where user_id = auth.uid() and at > now() - interval '1 hour') < 10;
$$;

-- Wrong codes return null instead of raising, so the failed try is kept (an error would roll it back).
create or replace function public.claim_record(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare cc record; me uuid; old_hid uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if not public.code_tries_left() then raise exception 'Too many tries. Wait an hour, or ask your leader for a new code.'; end if;
  select * into cc from public.claim_codes where code = lower(trim(p_code)) and used_by is null and expires_at > now();
  if cc is null then
    insert into public.code_attempts (user_id) values (auth.uid());
    return null;
  end if;
  me := public.my_person_id();
  if me is null and cc.person_id is not null
     and (select user_id from public.persons where id = cc.person_id) is null
     and (select type from public.persons where id = cc.person_id) = 'adult' then
    update public.persons set user_id = auth.uid() where id = cc.person_id;
  else
    if me is null then
      insert into public.persons (user_id, first_name, last_name, type) values (auth.uid(), 'New', '', 'adult') returning id into me;
    end if;
    select hm.household_id into old_hid from public.household_members hm
      where hm.person_id = me and hm.household_id <> cc.household_id
        and (select count(*) from public.household_members x where x.household_id = hm.household_id) = 1 limit 1;
    insert into public.household_members (household_id, person_id, relation, is_guardian)
    values (cc.household_id, me, 'parent', true) on conflict do nothing;
    if old_hid is not null then delete from public.households where id = old_hid; end if;
  end if;
  update public.claim_codes set used_by = auth.uid() where code = cc.code;
  insert into public.audit_log (org_id, actor_id, action, target_type, target_id)
    values (cc.org_id, public.my_person_id(), 'family.claimed', 'household', cc.household_id);
  return cc.household_id;
end;
$$;

create or replace function public.accept_household_invite(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid; inv record; old_hid uuid;
begin
  me := public.my_person_id();
  if me is null then raise exception 'Finish your profile first'; end if;
  if not public.code_tries_left() then raise exception 'Too many tries. Wait an hour, or ask for a new family code.'; end if;
  select * into inv from public.household_invites where code = lower(trim(p_code)) and used_by is null and expires_at > now();
  if inv is null then
    insert into public.code_attempts (user_id) values (auth.uid());
    return null;
  end if;

  select hm.household_id into old_hid from public.household_members hm
  where hm.person_id = me and hm.household_id <> inv.household_id
    and (select count(*) from public.household_members x where x.household_id = hm.household_id) = 1
  limit 1;

  insert into public.household_members (household_id, person_id, relation, is_guardian)
  values (inv.household_id, me, 'guardian', true) on conflict do nothing;
  update public.household_invites set used_by = me where code = inv.code;
  if old_hid is not null then delete from public.households where id = old_hid; end if;
  return inv.household_id;
end;
$$;

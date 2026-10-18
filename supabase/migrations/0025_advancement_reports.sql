-- 0025: auto-complete on final sign-off, unit advancement summary, sign-off queue.

create or replace function public.auto_complete_item()
returns trigger language plpgsql security definer set search_path = public as $$
declare iid uuid; total int; signed int;
begin
  if new.approved_by is null then return new; end if;
  select item_id into iid from public.advancement_requirements where id = new.requirement_id;
  select count(*) into total from public.advancement_requirements where item_id = iid;
  select count(*) into signed from public.requirement_progress rp join public.advancement_requirements r on r.id = rp.requirement_id
    where rp.person_id = new.person_id and r.item_id = iid and rp.approved_by is not null;
  if total > 0 and signed >= total then
    insert into public.scout_advancement (org_id, person_id, item_id, status, completed_at)
    values (new.org_id, new.person_id, iid, 'completed', now())
    on conflict (person_id, item_id) do update set status = 'completed', completed_at = coalesce(public.scout_advancement.completed_at, now());
  end if;
  return new;
end;
$$;
drop trigger if exists trg_auto_complete on public.requirement_progress;
create trigger trg_auto_complete after insert or update of approved_by on public.requirement_progress
  for each row execute function public.auto_complete_item();

-- The completion guard must allow this internal auto-complete (it runs as the signing leader/counselor).

create or replace function public.unit_advancement(p_org uuid)
returns table (person_id uuid, first_name text, last_name text, birthdate date,
               current_rank text, current_rank_sort int, rank_earned_at timestamptz,
               badges_earned bigint, eagle_groups bigint, badges_in_progress bigint, pending_signoffs bigint)
language sql stable security definer as $$
  with youth as (
    select p.id, p.first_name, p.last_name, p.birthdate from public.memberships m join public.persons p on p.id = m.person_id
    where m.org_id = p_org and m.status = 'active' and p.type = 'youth'
  ), done as (
    select a.person_id, i.kind, i.code, i.name, i.sort, i.eagle_required, i.eagle_group, i.program, a.completed_at, a.status
    from public.scout_advancement a join public.advancement_items i on i.id = a.item_id where a.org_id = p_org
  )
  select y.id, y.first_name, y.last_name, y.birthdate,
    (select d.name from done d where d.person_id = y.id and d.kind = 'rank' and d.status = 'completed' order by d.sort desc limit 1),
    (select d.sort from done d where d.person_id = y.id and d.kind = 'rank' and d.status = 'completed' order by d.sort desc limit 1),
    (select d.completed_at from done d where d.person_id = y.id and d.kind = 'rank' and d.status = 'completed' order by d.sort desc limit 1),
    (select count(*) from done d where d.person_id = y.id and d.kind = 'badge' and d.status = 'completed'),
    (select count(distinct coalesce(d.eagle_group, d.code)) from done d where d.person_id = y.id and d.kind = 'badge' and d.status = 'completed' and d.eagle_required),
    (select count(*) from done d where d.person_id = y.id and d.kind = 'badge' and d.status in ('in_progress','assigned','requested')),
    (select count(*) from public.requirement_progress rp where rp.person_id = y.id and rp.org_id = p_org and rp.completed_at is not null and rp.approved_by is null)
  from youth y
  where public.is_org_leader(p_org)
  order by 6 desc nulls last, y.last_name;
$$;

create or replace function public.signoff_queue(p_org uuid)
returns table (progress_id uuid, person_id uuid, scout text, item text, item_kind text, item_id uuid, number text, requirement text, done_at timestamptz, can_sign boolean)
language sql stable security definer as $$
  select rp.id, rp.person_id, p.first_name || ' ' || p.last_name, i.name, i.kind, i.id, r.number, r.text, rp.completed_at,
         public.can_sign_requirement(p_org, rp.requirement_id)
  from public.requirement_progress rp
  join public.persons p on p.id = rp.person_id
  join public.advancement_requirements r on r.id = rp.requirement_id
  join public.advancement_items i on i.id = r.item_id
  where rp.org_id = p_org and rp.completed_at is not null and rp.approved_by is null
    and (public.is_org_leader(p_org) or public.can_counsel(p_org, i.id))
  order by rp.completed_at;
$$;

create or replace function public.awards_to_buy(p_org uuid)
returns table (adv_id uuid, scout text, item text, kind text, completed_at timestamptz, purchased_at timestamptz, presented_at timestamptz)
language sql stable security definer as $$
  select a.id, p.first_name || ' ' || p.last_name, i.name, i.kind, a.completed_at, a.purchased_at, a.presented_at
  from public.scout_advancement a join public.persons p on p.id = a.person_id join public.advancement_items i on i.id = a.item_id
  where a.org_id = p_org and a.status = 'completed' and a.presented_at is null and public.is_org_leader(p_org)
  order by a.purchased_at nulls first, i.kind, i.name;
$$;

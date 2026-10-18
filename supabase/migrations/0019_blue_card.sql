-- 0019: merit badge "blue card" flow and award tracking.
-- Scout requests -> unit leader approves and assigns an approved counselor -> counselor signs off.

alter table public.scout_advancement drop constraint if exists scout_advancement_status_check;
alter table public.scout_advancement add constraint scout_advancement_status_check
  check (status in ('requested','assigned','in_progress','completed','declined'));
alter table public.scout_advancement add column if not exists counselor_id uuid references public.persons(id) on delete set null;
alter table public.scout_advancement add column if not exists approved_to_start_by uuid references public.persons(id) on delete set null;
alter table public.scout_advancement add column if not exists approved_to_start_at timestamptz;
alter table public.scout_advancement add column if not exists purchased_at timestamptz;
alter table public.scout_advancement add column if not exists presented_at timestamptz;

-- Counselors may only be assigned badges they are approved for.
create or replace function public.guard_counselor_assignment()
returns trigger language plpgsql security definer as $$
begin
  if new.counselor_id is not null and new.counselor_id is distinct from old.counselor_id then
    if not exists (select 1 from public.merit_badge_counselors c where c.org_id = new.org_id and c.person_id = new.counselor_id and c.item_id = new.item_id) then
      raise exception 'That counselor is not approved for this merit badge';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_counselor on public.scout_advancement;
create trigger trg_guard_counselor before update on public.scout_advancement for each row execute function public.guard_counselor_assignment();

-- Counselor sign-off applies only to Scouts assigned to them for that badge (or any approved
-- counselor if the unit has not assigned one yet).
create or replace function public.can_sign_requirement(org uuid, req uuid)
returns boolean language sql stable security definer as $$
  select public.is_org_leader(org)
      or exists (
        select 1 from public.advancement_requirements r
        join public.advancement_items i on i.id = r.item_id
        where r.id = req and i.kind = 'badge' and public.can_counsel(org, i.id)
      );
$$;

create or replace function public.approve_badge_start(p_adv uuid, p_counselor uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a record;
begin
  select * into a from public.scout_advancement where id = p_adv;
  if a is null or not public.is_org_leader(a.org_id) then raise exception 'Only unit leaders approve merit badge starts'; end if;
  update public.scout_advancement set status = 'in_progress', counselor_id = p_counselor,
    approved_to_start_by = public.my_person_id(), approved_to_start_at = now() where id = p_adv;
  insert into public.audit_log (org_id, actor_id, action, target_type, target_id, payload)
  values (a.org_id, public.my_person_id(), 'badge.approved_to_start', 'scout_advancement', p_adv, jsonb_build_object('counselor', p_counselor));
end;
$$;

-- Counselors list: who they counsel and which Scouts are assigned to them.
create or replace function public.my_counselees(p_org uuid)
returns table (adv_id uuid, scout_id uuid, scout_name text, item_id uuid, badge text, status text)
language sql stable security definer as $$
  select a.id, a.person_id, p.first_name || ' ' || p.last_name, a.item_id, i.name, a.status
  from public.scout_advancement a join public.persons p on p.id = a.person_id join public.advancement_items i on i.id = a.item_id
  where a.org_id = p_org and a.counselor_id = public.my_person_id() and a.status in ('in_progress','completed')
  order by a.status, p.last_name;
$$;

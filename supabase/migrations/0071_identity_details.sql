-- Names, pronouns and gender (Floyd, 2026-10-23). Scouts BSA troops are registered as boy or girl troops, so
-- the roster needs the gender on each Scout's Scouting America registration, for Scoutbook and roster placement.
-- It's labeled as "on the Scouting America registration", not "at birth": the family's official record decides.
-- Nothing in the app blocks or sorts anyone by it. Pronouns and the preferred name (nickname, already a column)
-- are the family's to share with the troop. Gender and the housing note are private details, seen only by the
-- family and leaders with private-detail access (current YPT, two-step), and each look is logged.
alter table public.persons add column if not exists pronouns text check (pronouns is null or length(pronouns) <= 40);
alter table public.persons add column if not exists registered_gender text check (registered_gender in ('male', 'female'));
alter table public.persons add column if not exists accommodation_note text check (accommodation_note is null or length(accommodation_note) <= 500);

-- 0034 granted SELECT column by column, so new columns start hidden. Only pronouns joins the visible set.
grant select (pronouns) on public.persons to authenticated;

create or replace function public.person_identity(p_org uuid, p_ids uuid[])
returns table (id uuid, nickname text, pronouns text, registered_gender text, accommodation_note text)
language plpgsql security definer set search_path = public as $$
declare staff boolean; others int;
begin
  staff := p_org is not null and public.has_perm(p_org, 'members.private');
  select count(*) into others from public.persons x
    where x.id = any(p_ids) and not public.can_act_for(x.id)
      and exists (select 1 from public.memberships m where m.person_id = x.id and m.org_id = p_org);
  if staff and others > 0 then
    insert into public.audit_log (org_id, actor_id, action, target_type, payload)
    values (p_org, public.my_person_id(), 'private.viewed', 'persons', jsonb_build_object('count', others, 'fields', 'identity'));
  end if;
  return query
    select x.id, x.nickname, x.pronouns, x.registered_gender, x.accommodation_note from public.persons x
    where x.id = any(p_ids)
      and (public.can_act_for(x.id)
           or (staff and exists (select 1 from public.memberships m where m.person_id = x.id and m.org_id = p_org)));
end;
$$;
grant execute on function public.person_identity(uuid, uuid[]) to authenticated;

-- The family (or the person themselves), or a unit admin for someone in their unit. The admin also needs
-- private-detail access (current YPT, two-step), the same as reading these fields in person_identity().
create or replace function public.set_person_identity(p_org uuid, p_person uuid, p_nickname text, p_pronouns text, p_gender text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.can_act_for(p_person)
          or (public.is_org_admin(p_org) and public.has_perm(p_org, 'members.private') and public.person_in_org(p_person, p_org))) then
    raise exception 'Only the family or a unit admin can change this';
  end if;
  if p_gender is not null and p_gender not in ('male', 'female') then raise exception 'Choose male or female, or leave it blank'; end if;
  update public.persons set
    nickname = nullif(trim(p_nickname), ''),
    pronouns = nullif(trim(p_pronouns), ''),
    registered_gender = p_gender,
    accommodation_note = nullif(trim(p_note), '')
  where id = p_person;
  insert into public.audit_log (org_id, actor_id, action, target_type, target_id)
    values (p_org, public.my_person_id(), 'person.identity_changed', 'person', p_person);
end;
$$;
grant execute on function public.set_person_identity(uuid, uuid, text, text, text, text) to authenticated;

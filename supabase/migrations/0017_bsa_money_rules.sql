-- 0017: Scouting America money-earning rules enforced in the data.
--  * Every fundraiser needs a council-approved Unit Money-Earning Application before it starts.
--  * No games of chance (raffles, bingo, lotteries).
--  * Units don't solicit contributions on their own: a donation campaign stays inactive until
--    the chartered organization / council approval is recorded.
--  * Scout account money belongs to the unit, is only applied to that Scout's Scouting costs,
--    and is never paid out as cash.

alter table public.fundraisers add column if not exists kind text not null default 'product'
  check (kind in ('product','service','event','other'));
alter table public.fundraisers add column if not exists money_earning_approved_on date;
alter table public.fundraisers add column if not exists description text;

create or replace function public.guard_fundraiser()
returns trigger language plpgsql as $$
begin
  if new.name ~* '(raffle|lottery|bingo|casino|poker|drawing|50/50|sweepstake)' or coalesce(new.description, '') ~* '(raffle|lottery|bingo|casino|poker|50/50|sweepstake)' then
    raise exception 'Scouting America does not allow games of chance (raffles, lotteries, bingo) as unit fundraisers';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_fundraiser on public.fundraisers;
create trigger trg_guard_fundraiser before insert or update on public.fundraisers for each row execute function public.guard_fundraiser();

create or replace function public.guard_sale()
returns trigger language plpgsql security definer as $$
declare f record;
begin
  select * into f from public.fundraisers where id = new.fundraiser_id;
  if f.money_earning_approved_on is null then
    raise exception 'Record the council-approved Unit Money-Earning Application date before taking sales';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_sale on public.fundraiser_sales;
create trigger trg_guard_sale before insert on public.fundraiser_sales for each row execute function public.guard_sale();

alter table public.donation_campaigns add column if not exists approved_by_text text;
alter table public.donation_campaigns add column if not exists approved_on date;
alter table public.donation_campaigns alter column active set default false;

create or replace function public.guard_campaign()
returns trigger language plpgsql as $$
begin
  if new.active and (coalesce(trim(new.approved_by_text), '') = '' or new.approved_on is null) then
    raise exception 'Record who approved this campaign (chartered organization or council) and when before turning it on';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_campaign on public.donation_campaigns;
create trigger trg_guard_campaign before insert or update on public.donation_campaigns for each row execute function public.guard_campaign();

-- Part C (physician exam) is required for any event longer than 72 hours.
create or replace function public.event_needs_part_c(p_event uuid)
returns boolean language sql stable as $$
  select coalesce(e.end_at - e.start_at > interval '72 hours', false) or e.kind = 'high_adventure'
  from public.events e where e.id = p_event;
$$;

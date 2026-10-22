-- Money fixes.
-- * A manual refund (the troop hands money back) was stored negative, so the family's balance went
--   DOWN by the refund. Charges and refunds raise what the family owes; payments and credits lower it
--   (the Stripe webhook already writes refunds positive).
-- * The household must belong to the unit recording it.
create or replace function public.record_manual(p_org uuid, p_household uuid, p_amount int, p_type text, p_method text, p_note text, p_event uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare lid uuid; signed int;
begin
  if not public.is_treasurer(p_org) then raise exception 'Only the treasurer or an admin can record money'; end if;
  if p_type not in ('charge','payment','credit','refund') then raise exception 'Bad type'; end if;
  if p_amount <= 0 then raise exception 'Enter a positive amount'; end if;
  if not public.household_in_org(p_household, p_org) then raise exception 'That family is not part of this unit'; end if;
  signed := case when p_type in ('charge', 'refund') then p_amount else -p_amount end;
  insert into public.ledger_entries (org_id, household_id, amount_cents, type, description, event_id, manual, method, created_by)
  values (p_org, p_household, signed, p_type, p_note, p_event, true, p_method, public.my_person_id()) returning id into lid;
  return lid;
end;
$$;

-- Manual refunds already recorded with the old (wrong) sign.
update public.ledger_entries set amount_cents = -amount_cents where type = 'refund' and manual and amount_cents < 0;

-- Stripe can deliver the same event twice at once; the check-then-insert in the webhook let both
-- through. These make the second insert fail, and the webhook treats that as already recorded.
create unique index if not exists ledger_stripe_payment_once on public.ledger_entries (stripe_pi_id) where type = 'payment' and stripe_pi_id is not null;
create unique index if not exists ledger_stripe_refund_once on public.ledger_entries (stripe_refund_id) where stripe_refund_id is not null;
create unique index if not exists unit_tx_stripe_once on public.unit_transactions (stripe_id, kind, category) where stripe_id is not null;

-- Refunded donations no longer count toward campaign goals.
alter table public.donations add column if not exists refunded_cents int not null default 0;
create or replace function public.public_campaign(p_slug text)
returns table (slug text, title text, description text, target_cents int, active boolean, org_name text, org_slug text, raised bigint, connected boolean)
language sql stable security definer set search_path = public as $$
  select c.slug, c.title, c.description, c.target_cents, c.active, o.name, o.slug,
         (select coalesce(sum(amount_cents - refunded_cents), 0) from public.donations d where d.campaign_id = c.id),
         o.stripe_account_id is not null
  from public.donation_campaigns c join public.organizations o on o.id = c.org_id where c.slug = p_slug;
$$;

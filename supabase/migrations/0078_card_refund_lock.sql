-- Card refunds: Stripe sends the running refunded total, and the webhook recorded the difference from what was
-- already on the books. Two refund events processed at the same moment could both see "nothing yet" and both
-- credit the family. Now one function does the read and the write under a per-payment lock (service role only).
create or replace function public.record_card_refund(p_pi text, p_total_refunded int)
returns int language plpgsql security definer set search_path = public as $$
declare orig record; don record; already int; delta int := 0;
begin
  perform pg_advisory_xact_lock(hashtext('card_refund:' || p_pi));
  select org_id, household_id, amount_cents into orig from public.ledger_entries where stripe_pi_id = p_pi and type = 'payment' limit 1;
  if orig.org_id is not null then
    select coalesce(sum(amount_cents), 0) into already from public.ledger_entries where stripe_pi_id = p_pi and type = 'refund';
    -- Capped at the payment itself: a refunded card fee was never on the family's balance.
    delta := least(p_total_refunded, -orig.amount_cents) - already;
    if delta > 0 then
      insert into public.ledger_entries (org_id, household_id, amount_cents, type, description, stripe_pi_id, stripe_refund_id, method)
      values (orig.org_id, orig.household_id, delta, 'refund', 'Card refund', p_pi, p_pi || '-refund-' || p_total_refunded, 'stripe')
      on conflict do nothing;
    end if;
    return greatest(delta, 0);
  end if;

  -- A refunded donation: reverse it as an expense so income, goals and reports stay honest.
  select org_id, amount_cents into don from public.donations where stripe_id = p_pi limit 1;
  if don.org_id is not null then
    select coalesce(sum(amount_cents), 0) into already from public.unit_transactions
      where stripe_id like p_pi || '-refund-%' and category = 'Donation refunds';
    delta := least(p_total_refunded, don.amount_cents) - already;
    if delta > 0 then
      insert into public.unit_transactions (org_id, kind, category, amount_cents, description, source, stripe_id)
      values (don.org_id, 'expense', 'Donation refunds', delta, 'Donation refunded', 'stripe', p_pi || '-refund-' || p_total_refunded)
      on conflict do nothing;
    end if;
    update public.donations set refunded_cents = least(p_total_refunded, don.amount_cents) where stripe_id = p_pi;
    return greatest(delta, 0);
  end if;
  return 0;
end;
$$;
revoke execute on function public.record_card_refund(text, int) from public, anon, authenticated;

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { adminClient } from "@/lib/admin";

// Connect webhook: the ledger is built from Stripe records, never typed in.
export async function POST(request: Request) {
  const s = stripe();
  const db = adminClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s || !db || !secret) return NextResponse.json({ error: "not configured" }, { status: 503 });

  let event: Stripe.Event;
  try {
    event = s.webhooks.constructEvent(await request.text(), request.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  // Bank payments finish later: "completed" arrives unpaid, then "async_payment_succeeded".
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== "paid") return NextResponse.json({ ok: true, pending: true });
    const m = session.metadata ?? {};
    const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? session.id;

    // Idempotent: Stripe may deliver the same event more than once.
    const { data: dupe } = await db.from("ledger_entries").select("id").eq("stripe_pi_id", pi).limit(1);
    const { data: dupe2 } = await db.from("donations").select("id").eq("stripe_id", pi).limit(1);
    if (dupe?.length || dupe2?.length) return NextResponse.json({ ok: true, duplicate: true });

    // Stripe's processing fee, less any fee the family or donor covered, is a unit expense: otherwise
    // the report shows the gross and never matches the bank deposit. Written first (unique per payment).
    if (m.org_id && (m.kind === "balance" || m.kind === "donation")) {
      try {
        const intent = await s.paymentIntents.retrieve(pi, { expand: ["latest_charge.balance_transaction"] }, event.account ? { stripeAccount: event.account } : undefined);
        const bt = (intent.latest_charge as Stripe.Charge | null)?.balance_transaction as Stripe.BalanceTransaction | null;
        const covered = m.kind === "donation" ? Number(m.fee_cents || 0) : Math.max(0, (session.amount_total ?? 0) - Number(m.amount_cents));
        const absorbed = (bt?.fee ?? 0) - covered;
        if (absorbed > 0) {
          const { error } = await db.from("unit_transactions").insert({
            org_id: m.org_id, kind: "expense", category: "Card processing fees", amount_cents: absorbed,
            description: m.kind === "donation" ? "Card fee on a donation" : "Card fee on a family payment", source: "stripe", stripe_id: pi,
          });
          if (error && error.code !== "23505") return NextResponse.json({ error: "fee write failed" }, { status: 500 });
        }
      } catch { /* fee details unavailable; the payment itself still records */ }
    }

    // A failed write answers 500 so Stripe retries; otherwise the family's payment never reaches the ledger.
    if (m.kind === "balance" && m.org_id && m.household_id) {
      const { error } = await db.from("ledger_entries").insert({
        org_id: m.org_id, household_id: m.household_id, amount_cents: -Number(m.amount_cents), type: "payment",
        description: "Online payment", stripe_pi_id: pi, method: "stripe", created_by: m.person_id || null,
      });
      if (error && error.code !== "23505") return NextResponse.json({ error: "ledger write failed" }, { status: 500 });
    }
    if (m.kind === "donation" && m.org_id) {
      // Unit income first: the donations row is the duplicate marker, so it must be written last.
      const { data: income } = await db.from("unit_transactions").select("id").eq("stripe_id", pi).eq("category", "Donations").limit(1);
      if (!income?.length) {
        const { error } = await db.from("unit_transactions").insert({
          org_id: m.org_id, kind: "income", category: "Donations", amount_cents: Number(m.amount_cents),
          description: "Donation", source: "stripe", stripe_id: pi,
        });
        if (error && error.code !== "23505") return NextResponse.json({ error: "income write failed" }, { status: 500 });
      }
      const { error } = await db.from("donations").insert({
        org_id: m.org_id, campaign_id: m.campaign_id || null, amount_cents: Number(m.amount_cents), fee_cents: Number(m.fee_cents || 0),
        donor_name: session.customer_details?.name ?? null, donor_email: session.customer_details?.email ?? null,
        source: m.source ?? null, stripe_id: pi,
      });
      if (error && error.code !== "23505") return NextResponse.json({ error: "donation write failed" }, { status: 500 });
    }
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
    if (pi) {
      const { data: orig } = await db.from("ledger_entries").select("org_id, household_id, amount_cents").eq("stripe_pi_id", pi).eq("type", "payment").maybeSingle();
      // amount_refunded is the running total for the charge, so record only what's new since the
      // refunds already on the ledger (partial refunds arrive as separate events).
      const { data: prior } = await db.from("ledger_entries").select("amount_cents").eq("stripe_pi_id", pi).eq("type", "refund");
      const already = (prior ?? []).reduce((t, r) => t + r.amount_cents, 0);
      // Capped at the payment itself: a refunded card fee was never on the family's balance.
      const delta = orig ? Math.min(charge.amount_refunded, -orig.amount_cents) - already : 0;
      // A refunded donation: reverse it as an expense so income, goals and reports stay honest.
      if (!orig) {
        const { data: don } = await db.from("donations").select("org_id, amount_cents").eq("stripe_id", pi).maybeSingle();
        if (don) {
          const { data: priorD } = await db.from("unit_transactions").select("amount_cents").like("stripe_id", `${pi}-refund-%`).eq("category", "Donation refunds");
          const doneD = (priorD ?? []).reduce((t, r) => t + r.amount_cents, 0);
          const newD = Math.min(charge.amount_refunded, don.amount_cents) - doneD;
          if (newD > 0) {
            const { error } = await db.from("unit_transactions").insert({
              org_id: don.org_id, kind: "expense", category: "Donation refunds", amount_cents: newD,
              description: "Donation refunded", source: "stripe", stripe_id: `${pi}-refund-${charge.amount_refunded}`,
            });
            if (error && error.code !== "23505") return NextResponse.json({ error: "refund write failed" }, { status: 500 });
          }
          await db.from("donations").update({ refunded_cents: Math.min(charge.amount_refunded, don.amount_cents) }).eq("stripe_id", pi);
        }
      }
      if (orig && delta > 0) {
        const { error } = await db.from("ledger_entries").insert({
          org_id: orig.org_id, household_id: orig.household_id, amount_cents: delta, type: "refund",
          description: "Card refund", stripe_pi_id: pi, stripe_refund_id: `${pi}-refund-${charge.amount_refunded}`, method: "stripe",
        });
        if (error && error.code !== "23505") return NextResponse.json({ error: "refund write failed" }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true });
}

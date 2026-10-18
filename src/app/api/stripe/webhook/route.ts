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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const m = session.metadata ?? {};
    const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? session.id;

    // Idempotent: Stripe may deliver the same event more than once.
    const { data: dupe } = await db.from("ledger_entries").select("id").eq("stripe_pi_id", pi).limit(1);
    const { data: dupe2 } = await db.from("donations").select("id").eq("stripe_id", pi).limit(1);
    if (dupe?.length || dupe2?.length) return NextResponse.json({ ok: true, duplicate: true });

    if (m.kind === "balance" && m.org_id && m.household_id) {
      await db.from("ledger_entries").insert({
        org_id: m.org_id, household_id: m.household_id, amount_cents: -Number(m.amount_cents), type: "payment",
        description: "Online payment", stripe_pi_id: pi, method: "stripe", created_by: m.person_id || null,
      });
    }
    if (m.kind === "donation" && m.org_id) {
      await db.from("donations").insert({
        org_id: m.org_id, campaign_id: m.campaign_id || null, amount_cents: Number(m.amount_cents), fee_cents: Number(m.fee_cents || 0),
        donor_name: session.customer_details?.name ?? null, donor_email: session.customer_details?.email ?? null,
        source: m.source ?? null, stripe_id: pi,
      });
      await db.from("unit_transactions").insert({
        org_id: m.org_id, kind: "income", category: "Donations", amount_cents: Number(m.amount_cents),
        description: "Donation", source: "stripe", stripe_id: pi,
      });
    }
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
    if (pi) {
      const { data: orig } = await db.from("ledger_entries").select("org_id, household_id").eq("stripe_pi_id", pi).eq("type", "payment").maybeSingle();
      const refundId = charge.refunds?.data?.[0]?.id ?? `${pi}-refund`;
      const { data: exists } = await db.from("ledger_entries").select("id").eq("stripe_refund_id", refundId).limit(1);
      if (orig && !exists?.length) {
        await db.from("ledger_entries").insert({
          org_id: orig.org_id, household_id: orig.household_id, amount_cents: charge.amount_refunded, type: "refund",
          description: "Card refund", stripe_pi_id: pi, stripe_refund_id: refundId, method: "stripe",
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}

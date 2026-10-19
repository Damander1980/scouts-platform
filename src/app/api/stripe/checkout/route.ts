import { NextResponse } from "next/server";
import { getContext } from "@/lib/context";
import { stripe } from "@/lib/stripe";
import { coverFee } from "@/lib/fees";
import { adminClient, SITE_URL } from "@/lib/admin";
import { householdBalance } from "@/lib/family";

// Family pays their current balance (or part of it) to the unit's connected account.
export async function POST(request: Request) {
  const { amountCents } = await request.json().catch(() => ({}));
  const ctx = await getContext();
  if (!ctx.current || !ctx.householdId) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const s = stripe();
  const db = adminClient();
  if (!s || !db) return NextResponse.json({ error: "Online payments aren't set up yet. Pay the treasurer by cash or check." }, { status: 503 });

  const { data: org } = await db.from("organizations").select("id, name, stripe_account_id").eq("id", ctx.current.org.id).single();
  if (!org?.stripe_account_id) return NextResponse.json({ error: "Your unit hasn't connected a bank account yet. Pay the treasurer directly for now." }, { status: 409 });

  const balance = await householdBalance(ctx.supabase, ctx.householdId, org.id);
  const amount = Math.min(Math.max(Math.round(Number(amountCents) || balance), 50), Math.max(balance, 50));
  if (balance <= 0) return NextResponse.json({ error: "You don't owe anything right now." }, { status: 400 });
  const fee = coverFee(amount);

  const session = await s.checkout.sessions.create({
    mode: "payment",
    line_items: [
      { quantity: 1, price_data: { currency: "usd", unit_amount: amount, product_data: { name: `${org.name} balance` } } },
      { quantity: 1, price_data: { currency: "usd", unit_amount: fee, product_data: { name: "Card processing fee (pay in person to avoid it)" } } },
    ],
    customer_email: ctx.user.email ?? undefined,
    success_url: `${SITE_URL}/pay?paid=1`,
    cancel_url: `${SITE_URL}/pay`,
    metadata: { kind: "balance", org_id: org.id, household_id: ctx.householdId, amount_cents: String(amount), person_id: ctx.person?.id ?? "" },
    payment_intent_data: { metadata: { kind: "balance", org_id: org.id, household_id: ctx.householdId } },
  }, { stripeAccount: org.stripe_account_id });

  return NextResponse.json({ url: session.url });
}

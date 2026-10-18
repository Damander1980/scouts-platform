import { NextResponse } from "next/server";
import { coverFee, stripe } from "@/lib/stripe";
import { adminClient, SITE_URL } from "@/lib/admin";

// Public donation checkout. No account needed; Apple Pay / Google Pay come with Checkout.
export async function POST(request: Request) {
  const { campaign, amountCents, coverFees, source } = await request.json().catch(() => ({}));
  const s = stripe();
  const db = adminClient();
  if (!s || !db) return NextResponse.json({ error: "Online giving isn't available yet." }, { status: 503 });
  const amount = Math.round(Number(amountCents));
  if (!Number.isFinite(amount) || amount < 100 || amount > 1_000_000) return NextResponse.json({ error: "Enter an amount between $1 and $10,000." }, { status: 400 });

  const { data: c } = await db.from("donation_campaigns").select("id, org_id, slug, title, active, organizations(name, stripe_account_id)").eq("slug", String(campaign)).maybeSingle();
  const org = c?.organizations as unknown as { name: string; stripe_account_id: string | null } | undefined;
  if (!c || !c.active || !org?.stripe_account_id) return NextResponse.json({ error: "This campaign isn't accepting gifts right now." }, { status: 404 });
  const fee = coverFees ? coverFee(amount) : 0;

  const session = await s.checkout.sessions.create({
    mode: "payment",
    submit_type: "donate",
    line_items: [
      { quantity: 1, price_data: { currency: "usd", unit_amount: amount, product_data: { name: `Gift to ${org.name}: ${c.title}` } } },
      ...(fee ? [{ quantity: 1, price_data: { currency: "usd", unit_amount: fee, product_data: { name: "Covering the card fee" } } }] : []),
    ],
    success_url: `${SITE_URL}/give/${c.slug}?thanks=1`,
    cancel_url: `${SITE_URL}/give/${c.slug}`,
    metadata: { kind: "donation", org_id: c.org_id, campaign_id: c.id, amount_cents: String(amount), fee_cents: String(fee), source: String(source ?? "link").slice(0, 30) },
  }, { stripeAccount: org.stripe_account_id });

  return NextResponse.json({ url: session.url });
}

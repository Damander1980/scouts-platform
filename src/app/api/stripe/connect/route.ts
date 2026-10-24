import { NextResponse } from "next/server";
import { getContext } from "@/lib/context";
import { stripe } from "@/lib/stripe";
import { adminClient, SITE_URL } from "@/lib/admin";

// Starts (or resumes) Stripe Connect onboarding for the unit. Funds settle to the unit's bank.
export async function POST() {
  const ctx = await getContext();
  if (!ctx.current || !ctx.isAdmin) return NextResponse.json({ error: "Only unit admins can connect payments" }, { status: 403 });
  const s = stripe();
  const db = adminClient();
  if (!s || !db) return NextResponse.json({ error: "Payments aren't configured on this server yet." }, { status: 503 });

  const org = ctx.current.org;
  const { data: row } = await db.from("organizations").select("stripe_account_id").eq("id", org.id).single();
  let account = row?.stripe_account_id as string | null;
  if (!account) {
    const acct = await s.accounts.create({
      type: "express",
      business_profile: { name: org.name, product_description: "Youth program dues, event fees and donations" },
      metadata: { org_id: org.id },
    });
    // Only fills an empty slot: a double click that created a second account keeps the first one.
    await db.from("organizations").update({ stripe_account_id: acct.id }).eq("id", org.id).is("stripe_account_id", null);
    const { data: saved } = await db.from("organizations").select("stripe_account_id").eq("id", org.id).single();
    account = (saved?.stripe_account_id as string | null) ?? acct.id;
  }
  const link = await s.accountLinks.create({
    account, type: "account_onboarding",
    refresh_url: `${SITE_URL}/admin/money?connect=retry`, return_url: `${SITE_URL}/admin/money?connect=done`,
  });
  return NextResponse.json({ url: link.url });
}

import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { adminClient } from "@/lib/admin";

// Resend (Svix) webhook: a permanent bounce or a spam complaint puts the address on hold so we stop mailing it.
// Set RESEND_WEBHOOK_SECRET (whsec_...) and point the webhook at /api/webhooks/resend for the events
// email.bounced and email.complained. Without the secret every call is refused.
function verify(body: string, id: string, ts: string, sigHeader: string, secret: string) {
  if (!id || !ts || !sigHeader) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest();
  return sigHeader.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const got = Buffer.from(sig, "base64");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const body = await request.text();
  const h = request.headers;
  if (!verify(body, h.get("svix-id") ?? "", h.get("svix-timestamp") ?? "", h.get("svix-signature") ?? "", secret)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }
  const event = JSON.parse(body) as { type?: string; data?: { to?: string[]; bounce?: { type?: string; message?: string } } };
  const reason = event.type === "email.complained" ? "complaint" : event.type === "email.bounced" && event.data?.bounce?.type === "Permanent" ? "bounce" : null;
  const db = adminClient();
  if (!reason || !db) return NextResponse.json({ ok: true });
  const rows = (event.data?.to ?? []).map((e) => ({ email: e.trim().toLowerCase(), reason, detail: event.data?.bounce?.message?.slice(0, 300) ?? null }));
  if (rows.length) await db.from("email_suppressions").upsert(rows, { onConflict: "email" });
  return NextResponse.json({ ok: true });
}

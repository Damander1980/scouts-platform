import { NextResponse } from "next/server";
import { adminClient, SITE_URL } from "@/lib/admin";
import { unsubscribeToken } from "@/lib/messageEmail";

// RFC 8058 one-click unsubscribe: mail apps POST here directly.
export async function POST(request: Request) {
  const url = new URL(request.url);
  const p = url.searchParams.get("p"), t = url.searchParams.get("t");
  const db = adminClient();
  if (!db || !p || !t || t !== unsubscribeToken(p)) return NextResponse.json({ ok: false }, { status: 400 });
  await db.from("notification_prefs").upsert({ person_id: p, email_on: false, updated_at: new Date().toISOString() });
  await db.from("notification_log").insert({ person_id: p, channel: "email", category: "unsubscribe", status: "opted_out" });
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return NextResponse.redirect(`${SITE_URL}/unsubscribe?${url.searchParams.toString()}`);
}

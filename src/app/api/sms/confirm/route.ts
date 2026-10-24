import { NextResponse } from "next/server";
import { getContext } from "@/lib/context";
import { adminClient, SITE_URL } from "@/lib/admin";
import { sendSms } from "@/lib/notify";

// Sends the opt-in confirmation text right after someone agrees to texts in Settings.
// Only to the caller's own saved number, and only within 10 minutes of a recorded consent,
// so it cannot be used to text arbitrary numbers or repeat-text someone.
export async function POST() {
  const ctx = await getContext();
  const db = adminClient();
  if (!ctx.person || !db) return NextResponse.json({ ok: false }, { status: 401 });
  const { data: p } = await db.from("notification_prefs").select("sms_on, sms_phone, sms_consent_at").eq("person_id", ctx.person.id).maybeSingle();
  if (!p?.sms_on || !p.sms_phone || !p.sms_consent_at || Date.now() - new Date(p.sms_consent_at).getTime() > 10 * 60 * 1000) {
    return NextResponse.json({ ok: false, reason: "no recent consent" }, { status: 400 });
  }
  const { data: sent } = await db.from("notification_log").select("id").eq("person_id", ctx.person.id).eq("category", "opt_in_confirm")
    .gte("created_at", p.sms_consent_at).limit(1);
  if (sent?.length) return NextResponse.json({ ok: true, already: true });

  const r = await sendSms(p.sms_phone, `You're signed up for unit texts from Our Troop Manager. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out. ${SITE_URL}/settings`);
  await db.from("notification_log").insert({ person_id: ctx.person.id, channel: "sms", category: "opt_in_confirm", status: r.status, provider_id: r.id ?? null });
  return NextResponse.json({ ok: r.status !== "failed", status: r.status });
}

import { NextResponse } from "next/server";
import { adminClient } from "@/lib/admin";
import { notifyPeople } from "@/lib/notify";

// Runs daily (see vercel.json). Protected by CRON_SECRET.
//  1) RSVP deadline reminders, only to families who haven't responded.
//  2) Weekly digest on each person's chosen day.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = adminClient();
  if (!db) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const now = new Date();
  const in48 = new Date(now.getTime() + 48 * 3600000).toISOString();
  let reminders = 0, digests = 0;

  const { data: dueEvents } = await db.from("events").select("id, org_id, title, rsvp_deadline")
    .eq("canceled", false).gt("rsvp_deadline", now.toISOString()).lt("rsvp_deadline", in48);
  for (const ev of dueEvents ?? []) {
    const { data: already } = await db.from("notification_log").select("id").eq("category", `deadline:${ev.id}`).limit(1);
    if (already?.length) continue;
    const { data: members } = await db.from("memberships").select("person_id, persons(type)").eq("org_id", ev.org_id).eq("status", "active");
    const { data: rsvps } = await db.from("rsvps").select("person_id").eq("event_id", ev.id);
    const replied = new Set((rsvps ?? []).map((r) => r.person_id));
    const waiting = (members ?? []).filter((m) => !replied.has(m.person_id));
    // Youth are reached through their parents: notify guardians of youth who haven't replied, and adults who haven't.
    const guardianIds = new Set<string>();
    for (const m of waiting) {
      if ((m.persons as unknown as { type: string }).type === "adult") { guardianIds.add(m.person_id); continue; }
      const { data: hh } = await db.from("household_members").select("household_id").eq("person_id", m.person_id);
      for (const h of hh ?? []) {
        const { data: gs } = await db.from("household_members").select("person_id").eq("household_id", h.household_id).eq("is_guardian", true);
        (gs ?? []).forEach((g) => guardianIds.add(g.person_id));
      }
    }
    const ids = [...guardianIds];
    if (ids.length) {
      await notifyPeople(ids, "deadlines", `Please RSVP for ${ev.title} by ${new Date(ev.rsvp_deadline!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.`, `/events/${ev.id}`);
      reminders += ids.length;
    }
    await db.from("notification_log").insert({ category: `deadline:${ev.id}`, channel: "system", status: "done" });
  }

  const today = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][now.getDay()];
  const { data: prefs } = await db.from("notification_prefs").select("person_id, digest_day, categories").eq("digest_day", today);
  const { data: noPrefsAdults } = today === "sun"
    ? await db.from("persons").select("id").eq("type", "adult").not("user_id", "is", null)
    : { data: [] as { id: string }[] };
  const prefPeople = new Set((prefs ?? []).filter((p) => (p.categories as Record<string, boolean>)?.digest !== false).map((p) => p.person_id));
  if (today === "sun") {
    const { data: all } = await db.from("notification_prefs").select("person_id");
    const hasPref = new Set((all ?? []).map((a) => a.person_id));
    (noPrefsAdults ?? []).forEach((p) => { if (!hasPref.has(p.id)) prefPeople.add(p.id); });
  }
  for (const pid of prefPeople) {
    const { data: ms } = await db.from("memberships").select("org_id").eq("person_id", pid).eq("status", "active");
    const orgIds = (ms ?? []).map((m) => m.org_id);
    if (!orgIds.length) continue;
    const { data: evs } = await db.from("events").select("title, start_at").in("org_id", orgIds).eq("canceled", false)
      .gte("start_at", now.toISOString()).lt("start_at", new Date(now.getTime() + 7 * 86400000).toISOString()).order("start_at").limit(5);
    if (!evs?.length) continue;
    const list = evs.map((e) => `${e.title} (${new Date(e.start_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })})`).join("; ");
    await notifyPeople([pid], "digest", `This week: ${list}.`, "/events");
    digests++;
  }

  return NextResponse.json({ reminders, digests });
}

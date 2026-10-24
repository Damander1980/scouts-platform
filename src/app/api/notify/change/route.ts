import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/admin";
import { claimOnce, guardiansOf, notifyPeople } from "@/lib/notify";
import { fmtDate, fmtTime } from "@/components/ui";

// A leader changed an event's time or place: tell everyone signed up (parents for Scouts).
// Urgent when the event is within two days, so it can reach people during quiet hours.
export async function POST(request: Request) {
  const { eventId, changed } = await request.json().catch(() => ({}));
  if (typeof eventId !== "string" || !Array.isArray(changed) || !changed.length) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = adminClient();
  if (!db) return NextResponse.json({ notified: 0 });
  const { data: ev } = await db.from("events").select("id, org_id, title, start_at, end_at, location, canceled").eq("id", eventId).maybeSingle();
  if (!ev || ev.canceled) return NextResponse.json({ notified: 0 });
  const { data: isLeader } = await supabase.rpc("has_perm", { org: ev.org_id, perm: "leader" });
  const { data: canEvents } = await supabase.rpc("has_perm", { org: ev.org_id, perm: "events.manage" });
  if (!isLeader && !canEvents) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // One notice per actual new time/place: repeat saves or POSTs don't text families again, but moving the
  // time away and back sends a fresh notice (the key carries how many notices this event has had).
  const prefix = `change:${ev.id}:`;
  const sig = `${ev.start_at}|${ev.end_at ?? ""}|${ev.location ?? ""}`;
  const { data: prior } = await db.from("notification_log").select("category").eq("channel", "system").like("category", `${prefix}%`).order("created_at", { ascending: false });
  // The count follows the last "#": a location such as "Room #4" has its own.
  const lastSig = (c: string) => c.slice(prefix.length, c.lastIndexOf("#"));
  if (prior?.[0] && lastSig(prior[0].category) === sig) return NextResponse.json({ notified: 0 });
  if (!(await claimOnce(db, `${prefix}${sig}#${prior?.length ?? 0}`))) return NextResponse.json({ notified: 0 });

  const { data: rs } = await db.from("rsvps").select("person_id, persons(type)").eq("event_id", ev.id).in("status", ["going", "waitlisted"]);
  const isAdult = (r: { persons: unknown }) => (r.persons as { type: string } | null)?.type === "adult";
  const guardians = await guardiansOf(db, (rs ?? []).filter((r) => !isAdult(r)).map((r) => r.person_id));
  const ids = new Set<string>();
  for (const r of rs ?? []) {
    if (isAdult(r)) ids.add(r.person_id);
    else (guardians.get(r.person_id) ?? []).forEach((g) => ids.add(g));
  }
  const soon = new Date(ev.start_at).getTime() - Date.now() < 48 * 3600000;
  const parts = [`now starts ${fmtDate(ev.start_at, { weekday: "short", month: "short", day: "numeric" })} at ${fmtTime(ev.start_at)}`];
  if (changed.includes("end") && ev.end_at) parts.push(`and ends ${fmtDate(ev.end_at, { weekday: "short", month: "short", day: "numeric" })} at ${fmtTime(ev.end_at)}`);
  if (changed.includes("location") && ev.location) parts.push(`at ${ev.location}`);
  if (ids.size) await notifyPeople([...ids], soon ? "urgent" : "reminders", `Updated: ${ev.title} ${parts.join(" ")}.`, `/events/${ev.id}`);
  return NextResponse.json({ notified: ids.size });
}

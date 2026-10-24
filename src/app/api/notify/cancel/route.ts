import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/admin";
import { claimOnce, guardiansOf, notifyPeople } from "@/lib/notify";
import { fmtDate } from "@/components/ui";

// An event was just canceled: tell everyone signed up (adults directly, Scouts through their
// parents) as an urgent notice, which may go out during quiet hours to people who opted in.
export async function POST(request: Request) {
  const { eventId } = await request.json().catch(() => ({}));
  if (typeof eventId !== "string") return NextResponse.json({ error: "bad request" }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = adminClient();
  if (!db) return NextResponse.json({ notified: 0 });
  const { data: ev } = await db.from("events").select("id, org_id, title, start_at, canceled, cost_cents").eq("id", eventId).maybeSingle();
  if (!ev || !ev.canceled) return NextResponse.json({ notified: 0 });
  // Only a leader of the host unit may trigger this (checked as the signed-in user).
  const { data: isLeader } = await supabase.rpc("has_perm", { org: ev.org_id, perm: "leader" });
  const { data: canEvents } = await supabase.rpc("has_perm", { org: ev.org_id, perm: "events.manage" });
  if (!isLeader && !canEvents) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const key = `cancel:${ev.id}`;
  // Claimed before sending, so a double click or retry can't send it twice.
  if (!(await claimOnce(db, key))) return NextResponse.json({ notified: 0 });

  const { data: rs } = await db.from("rsvps").select("person_id, persons(type)").eq("event_id", ev.id).in("status", ["going", "waitlisted"]);
  const isAdult = (r: { persons: unknown }) => (r.persons as { type: string } | null)?.type === "adult";
  const guardians = await guardiansOf(db, (rs ?? []).filter((r) => !isAdult(r)).map((r) => r.person_id));
  const ids = new Set<string>();
  for (const r of rs ?? []) {
    if (isAdult(r)) ids.add(r.person_id);
    else (guardians.get(r.person_id) ?? []).forEach((g) => ids.add(g));
  }
  const when = fmtDate(ev.start_at, { weekday: "short", month: "short", day: "numeric" });
  const money = ev.cost_cents > 0 ? " Anything you paid becomes a credit on your family account." : "";
  if (ids.size) await notifyPeople([...ids], "urgent", `CANCELED: ${ev.title} (${when}).${money}`, `/events/${ev.id}`);
  return NextResponse.json({ notified: ids.size });
}

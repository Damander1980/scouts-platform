import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/admin";
import { claimOnce, guardiansOf, notifyPeople } from "@/lib/notify";

// A Scout just signed up for a paid event that needs a parent's OK: tell their guardians.
// Only works for the signed-in Scout's own pending sign-up, and only once per sign-up.
export async function POST(request: Request) {
  const { eventId } = await request.json().catch(() => ({}));
  if (typeof eventId !== "string") return NextResponse.json({ error: "bad request" }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = adminClient();
  if (!db) return NextResponse.json({ notified: 0 });
  const { data: me } = await db.from("persons").select("id, first_name, type").eq("user_id", user.id).maybeSingle();
  if (!me || me.type !== "youth") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { data: r } = await db.from("rsvps").select("id, rsvp_approval_status, events(title)").eq("event_id", eventId).eq("person_id", me.id).maybeSingle();
  if (!r || r.rsvp_approval_status !== "pending") return NextResponse.json({ notified: 0 });

  const key = `approval:${r.id}`;
  // Claimed before sending, so a double click or retry can't send it twice.
  if (!(await claimOnce(db, key))) return NextResponse.json({ notified: 0 });

  const ids = new Set((await guardiansOf(db, [me.id])).get(me.id) ?? []);
  const title = (r.events as unknown as { title: string } | null)?.title ?? "an event";
  if (ids.size) await notifyPeople([...ids], "payments", `${me.first_name} signed up for ${title}. Please approve it so it goes on your family bill.`, `/events/${eventId}`);
  return NextResponse.json({ notified: ids.size });
}

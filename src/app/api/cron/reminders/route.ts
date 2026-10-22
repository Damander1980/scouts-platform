import { NextResponse } from "next/server";
import { adminClient } from "@/lib/admin";
import { notifyPeople } from "@/lib/notify";
import { fmtDate } from "@/components/ui";

// Runs daily (see vercel.json). Protected by CRON_SECRET.
//  1) RSVP deadline reminders, only to families who haven't responded.
//  2) Weekly digest on each person's chosen day.
//  3) Health form expiry: guardians hear 30 and 7 days before a Scout's form runs out.
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
    // Youth are reached through their parents. Parents of Scouts are reminded only about their Scouts
    // (a parent coming along is optional); adults with no Scout in the unit (leaders) about themselves.
    const guardianIds = new Set<string>();
    const parentsOfYouth = new Set<string>();
    for (const m of members ?? []) {
      if ((m.persons as unknown as { type: string }).type !== "youth") continue;
      const { data: hh } = await db.from("household_members").select("household_id").eq("person_id", m.person_id);
      for (const h of hh ?? []) {
        const { data: gs } = await db.from("household_members").select("person_id").eq("household_id", h.household_id).eq("is_guardian", true);
        (gs ?? []).forEach((g) => { parentsOfYouth.add(g.person_id); if (!replied.has(m.person_id)) guardianIds.add(g.person_id); });
      }
    }
    for (const m of waiting) {
      if ((m.persons as unknown as { type: string }).type === "adult" && !parentsOfYouth.has(m.person_id)) guardianIds.add(m.person_id);
    }
    const ids = [...guardianIds];
    if (ids.length) {
      await notifyPeople(ids, "deadlines", `Please RSVP for ${ev.title} by ${fmtDate(ev.rsvp_deadline!, { month: "short", day: "numeric" })}.`, `/events/${ev.id}`);
      reminders += ids.length;
    }
    await db.from("notification_log").insert({ category: `deadline:${ev.id}`, channel: "system", status: "done" });
  }

  // Health form expiry, 30 and 7 days out. Status only: we never hold the form itself.
  let formReminders = 0;
  for (const days of [30, 7]) {
    const day = new Date(now.getTime() + days * 86400000).toISOString().slice(0, 10);
    const { data: expiring } = await db.from("forms").select("id, org_id, person_id, type, expires_at, persons(first_name, type)")
      .in("type", ["health_ab", "health_c"]).gte("expires_at", day).lt("expires_at", day + "T23:59:59");
    for (const f of expiring ?? []) {
      const key = `form:${f.id}:${days}`;
      const { data: done } = await db.from("notification_log").select("id").eq("category", key).limit(1);
      if (done?.length) continue;
      const who = f.persons as unknown as { first_name: string; type: string };
      const ids = new Set<string>();
      if (who.type === "adult") ids.add(f.person_id);
      const { data: hh } = await db.from("household_members").select("household_id").eq("person_id", f.person_id);
      for (const h of hh ?? []) {
        const { data: gs } = await db.from("household_members").select("person_id").eq("household_id", h.household_id).eq("is_guardian", true);
        (gs ?? []).forEach((g) => ids.add(g.person_id));
      }
      if (ids.size) {
        const part = f.type === "health_c" ? "Part C" : "Parts A and B";
        await notifyPeople([...ids], "reminders", `${who.first_name}'s health form (${part}) expires in ${days} days. Download a blank form and give the new one to a leader.`, "/forms");
        formReminders += ids.size;
      }
      await db.from("notification_log").insert({ category: key, channel: "system", status: "done" });
    }
  }

  // Leaders' Youth Protection Training, 30 and 7 days out: without it they lose access to kids' private details.
  for (const days of [30, 7]) {
    const day = new Date(now.getTime() + days * 86400000).toISOString().slice(0, 10);
    const { data: lapsing } = await db.from("memberships").select("id, person_id").eq("status", "active").eq("ypt_expires", day);
    for (const m of lapsing ?? []) {
      const key = `ypt:${m.id}:${days}`;
      const { data: done } = await db.from("notification_log").select("id").eq("category", key).limit(1);
      if (done?.length) continue;
      await notifyPeople([m.person_id], "reminders", `Your Youth Protection Training expires in ${days} days. Retake it at my.scouting.org, then update your date so you keep access to leader tools.`, "/settings");
      formReminders++;
      await db.from("notification_log").insert({ category: key, channel: "system", status: "done" });
    }
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
    // What the family owes, so the digest is the one weekly nudge that covers everything.
    const { data: hh } = await db.from("household_members").select("household_id").eq("person_id", pid).eq("is_guardian", true);
    const hids = (hh ?? []).map((h) => h.household_id);
    const { data: ledger } = hids.length ? await db.from("ledger_entries").select("amount_cents").in("household_id", hids).in("org_id", orgIds) : { data: [] as { amount_cents: number }[] };
    const owed = (ledger ?? []).reduce((t, l) => t + l.amount_cents, 0);
    if (!evs?.length && owed <= 0) continue;
    const parts: string[] = [];
    if (evs?.length) parts.push(`This week: ${evs.map((e) => `${e.title} (${fmtDate(e.start_at, { weekday: "short", month: "short", day: "numeric" })})`).join("; ")}.`);
    if (owed > 0) parts.push(`Your family owes $${(owed / 100).toFixed(2)}.`);
    await notifyPeople([pid], "digest", parts.join(" "), owed > 0 && !evs?.length ? "/pay" : "/dashboard");
    digests++;
  }

  return NextResponse.json({ reminders, digests, formReminders });
}

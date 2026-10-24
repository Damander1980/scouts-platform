import { NextResponse } from "next/server";
import { adminClient } from "@/lib/admin";
import { claimOnce, notifyPeople } from "@/lib/notify";
import { fmtDate, isoDay } from "@/components/ui";

// Runs daily (Cloudflare Cron Trigger in wrangler.jsonc). Protected by CRON_SECRET.
//  1) Who hasn't answered: before a sign-up deadline, or before an outing with none. Parents get their Scouts' names.
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

  // Who hasn't answered: 48 hours before a sign-up deadline, or (for outings with no deadline) about 3 days
  // before they start. Parents hear which of their Scouts hasn't answered, by name; a Scout with their own
  // login is nudged directly too. Adults with no Scout in the unit (leaders) are reminded about themselves.
  const in72 = new Date(now.getTime() + 72 * 3600000).toISOString();
  const in96 = new Date(now.getTime() + 96 * 3600000).toISOString();
  const [{ data: deadlineEvents }, { data: soonEvents }] = await Promise.all([
    db.from("events").select("id, org_id, title, start_at, rsvp_deadline")
      .eq("canceled", false).gt("rsvp_deadline", now.toISOString()).lt("rsvp_deadline", in48),
    db.from("events").select("id, org_id, title, start_at, rsvp_deadline")
      .eq("canceled", false).is("rsvp_deadline", null).neq("kind", "meeting").gt("start_at", in72).lt("start_at", in96),
  ]);
  const due = [...(deadlineEvents ?? []), ...(soonEvents ?? [])];
  for (const ev of due) {
    if (!(await claimOnce(db, `deadline:${ev.id}`))) continue;
    const { data: members } = await db.from("memberships").select("person_id, persons(type, first_name, user_id)").eq("org_id", ev.org_id).eq("status", "active");
    const { data: rsvps } = await db.from("rsvps").select("person_id").eq("event_id", ev.id);
    const replied = new Set((rsvps ?? []).map((r) => r.person_id));
    type P = { type: string; first_name: string; user_id: string | null };
    const when = ev.rsvp_deadline
      ? `Sign-ups close ${fmtDate(ev.rsvp_deadline, { weekday: "short", month: "short", day: "numeric" })}.`
      : `It starts ${fmtDate(ev.start_at, { weekday: "short", month: "short", day: "numeric" })}.`;

    const kidsOf = new Map<string, string[]>(); // guardian -> names of their Scouts who haven't answered
    const parentsOfYouth = new Set<string>();
    const scoutsWithLogin: string[] = [];
    for (const m of members ?? []) {
      const p = m.persons as unknown as P;
      if (p.type !== "youth") continue;
      const silent = !replied.has(m.person_id);
      if (silent && p.user_id) scoutsWithLogin.push(m.person_id);
      const { data: hh } = await db.from("household_members").select("household_id").eq("person_id", m.person_id);
      for (const h of hh ?? []) {
        const { data: gs } = await db.from("household_members").select("person_id").eq("household_id", h.household_id).eq("is_guardian", true);
        for (const g of gs ?? []) {
          parentsOfYouth.add(g.person_id);
          if (silent) kidsOf.set(g.person_id, [...new Set([...(kidsOf.get(g.person_id) ?? []), p.first_name])]);
        }
      }
    }
    const names = (list: string[]) => list.length <= 1 ? list[0] : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`;
    for (const [guardian, kids] of kidsOf) {
      await notifyPeople([guardian], "deadlines", `${names(kids)} ${kids.length === 1 ? "hasn't" : "haven't"} answered for ${ev.title}. ${when} Sign them up, or ask them to answer.`, `/events/${ev.id}`);
      reminders++;
    }
    if (scoutsWithLogin.length) {
      await notifyPeople(scoutsWithLogin, "deadlines", `Are you going to ${ev.title}? ${when} Tap to answer.`, `/events/${ev.id}`);
      reminders += scoutsWithLogin.length;
    }
    const adults = (members ?? []).filter((m) => (m.persons as unknown as P).type === "adult" && !parentsOfYouth.has(m.person_id) && !replied.has(m.person_id)).map((m) => m.person_id);
    if (adults.length) {
      await notifyPeople(adults, "deadlines", `Please answer for ${ev.title}. ${when}`, `/events/${ev.id}`);
      reminders += adults.length;
    }
  }

  // Health form expiry, 30 and 7 days out. Status only: we never hold the form itself.
  let formReminders = 0;
  for (const days of [30, 7]) {
    const day = isoDay(new Date(now.getTime() + days * 86400000));
    const { data: expiring } = await db.from("forms").select("id, org_id, person_id, type, expires_at, persons(first_name, type)")
      .in("type", ["health_ab", "health_c"]).gte("expires_at", day).lt("expires_at", day + "T23:59:59");
    for (const f of expiring ?? []) {
      const key = `form:${f.id}:${days}`;
      if (!(await claimOnce(db, key))) continue;
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
    }
  }

  // Leaders' Youth Protection Training, 30 and 7 days out: without it they lose access to kids' private details.
  for (const days of [30, 7]) {
    const day = isoDay(new Date(now.getTime() + days * 86400000));
    const { data: lapsing } = await db.from("memberships").select("id, person_id").eq("status", "active").eq("ypt_expires", day);
    for (const m of lapsing ?? []) {
      const key = `ypt:${m.id}:${days}`;
      if (!(await claimOnce(db, key))) continue;
      await notifyPeople([m.person_id], "reminders", `Your Youth Protection Training expires in ${days} days. Retake it at my.scouting.org, then update your date so you keep access to leader tools.`, "/settings");
      formReminders++;
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

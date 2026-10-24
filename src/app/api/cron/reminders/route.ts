import { NextResponse } from "next/server";
import { adminClient } from "@/lib/admin";
import { claimMany, notifyMany, type Notice } from "@/lib/notify";
import { fmtDate, isoDay } from "@/components/ui";

// Runs daily (Cloudflare Cron Trigger in wrangler.jsonc). Protected by CRON_SECRET.
//  1) Who hasn't answered: before a sign-up deadline, or before an outing with none. Parents get their Scouts' names.
//  2) Health form expiry: guardians hear 30 and 7 days before a form runs out.
//  3) Leaders' Youth Protection Training, 30 and 7 days out.
//  4) Weekly digest on each person's chosen day.
// Everything is gathered first and sent in one batched pass at the end: Cloudflare limits how many outside
// calls one run may make, so lookups are done in bulk, never one per person.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = adminClient();
  if (!db) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const now = new Date();
  const hours = (h: number) => new Date(now.getTime() + h * 3600000).toISOString();
  const notices: Notice[] = [];
  const counts = { reminders: 0, formReminders: 0, digests: 0 };
  const add = (n: Notice, kind: keyof typeof counts) => { if (n.personIds.length) { notices.push(n); counts[kind] += n.personIds.length; } };

  // Guardians of a set of people, in two queries: person -> households -> guardians.
  const guardiansOf = async (personIds: string[]) => {
    const out = new Map<string, string[]>();
    if (!personIds.length) return out;
    const { data: links } = await db.from("household_members").select("household_id, person_id").in("person_id", personIds);
    const hhIds = [...new Set((links ?? []).map((l) => l.household_id))];
    const { data: gs } = hhIds.length ? await db.from("household_members").select("household_id, person_id").in("household_id", hhIds).eq("is_guardian", true) : { data: [] };
    const byHh = new Map<string, string[]>();
    for (const g of gs ?? []) byHh.set(g.household_id, [...(byHh.get(g.household_id) ?? []), g.person_id]);
    for (const l of links ?? []) out.set(l.person_id, [...new Set([...(out.get(l.person_id) ?? []), ...(byHh.get(l.household_id) ?? [])])]);
    return out;
  };
  const names = (list: string[]) => (list.length <= 1 ? list[0] : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`);

  // 1) Who hasn't answered: 48 hours before a sign-up deadline, or about 3 days before an outing with none.
  const [{ data: deadlineEvents }, { data: soonEvents }] = await Promise.all([
    db.from("events").select("id, org_id, title, start_at, rsvp_deadline")
      .eq("canceled", false).gt("rsvp_deadline", now.toISOString()).lt("rsvp_deadline", hours(48)),
    db.from("events").select("id, org_id, title, start_at, rsvp_deadline")
      .eq("canceled", false).is("rsvp_deadline", null).in("kind", ["campout", "high_adventure", "service", "fundraiser"]).gt("start_at", hours(72)).lt("start_at", hours(96)),
  ]);
  const due = [...(deadlineEvents ?? []), ...(soonEvents ?? [])];
  const claimedEvents = await claimMany(db, due.map((e) => `deadline:${e.id}`));
  for (const ev of due.filter((e) => claimedEvents.has(`deadline:${e.id}`))) {
    const [{ data: members }, { data: rsvps }] = await Promise.all([
      db.from("memberships").select("person_id, persons(type, first_name, user_id)").eq("org_id", ev.org_id).eq("status", "active"),
      db.from("rsvps").select("person_id").eq("event_id", ev.id),
    ]);
    type P = { type: string; first_name: string; user_id: string | null };
    const replied = new Set((rsvps ?? []).map((r) => r.person_id));
    const when = ev.rsvp_deadline
      ? `Sign-ups close ${fmtDate(ev.rsvp_deadline, { weekday: "short", month: "short", day: "numeric" })}.`
      : `It starts ${fmtDate(ev.start_at, { weekday: "short", month: "short", day: "numeric" })}.`;
    const path = `/events/${ev.id}`;
    const youth = (members ?? []).filter((m) => (m.persons as unknown as P).type === "youth");
    const guardians = await guardiansOf(youth.map((m) => m.person_id));
    const kidsOf = new Map<string, string[]>();
    const parentsOfYouth = new Set<string>();
    const scoutsWithLogin: string[] = [];
    for (const m of youth) {
      const p = m.persons as unknown as P;
      const silent = !replied.has(m.person_id);
      if (silent && p.user_id) scoutsWithLogin.push(m.person_id);
      for (const g of guardians.get(m.person_id) ?? []) {
        parentsOfYouth.add(g);
        if (silent) kidsOf.set(g, [...new Set([...(kidsOf.get(g) ?? []), p.first_name])]);
      }
    }
    const byText = new Map<string, string[]>();
    for (const [g, kids] of kidsOf) {
      const text = `${names(kids)} ${kids.length === 1 ? "hasn't" : "haven't"} answered for ${ev.title}. ${when} Sign them up, or ask them to answer.`;
      byText.set(text, [...(byText.get(text) ?? []), g]);
    }
    for (const [subject, personIds] of byText) add({ personIds, category: "deadlines", subject, path }, "reminders");
    add({ personIds: scoutsWithLogin, category: "deadlines", subject: `Are you going to ${ev.title}? ${when} Tap to answer.`, path }, "reminders");
    const adults = (members ?? []).filter((m) => (m.persons as unknown as P).type === "adult" && !parentsOfYouth.has(m.person_id) && !replied.has(m.person_id)).map((m) => m.person_id);
    add({ personIds: adults, category: "deadlines", subject: `Please answer for ${ev.title}. ${when}`, path }, "reminders");
  }

  // 2) Health form expiry, 30 and 7 days out. Status only: we never hold the form itself.
  for (const days of [30, 7]) {
    const day = isoDay(new Date(now.getTime() + days * 86400000));
    const { data: expiring } = await db.from("forms").select("id, person_id, type, persons(first_name, type)")
      .in("type", ["health_ab", "health_c"]).gte("expires_at", day).lt("expires_at", day + "T23:59:59");
    const claimed = await claimMany(db, (expiring ?? []).map((f) => `form:${f.id}:${days}`));
    const todo = (expiring ?? []).filter((f) => claimed.has(`form:${f.id}:${days}`));
    const guardians = await guardiansOf(todo.map((f) => f.person_id));
    for (const f of todo) {
      const who = f.persons as unknown as { first_name: string; type: string };
      const ids = new Set(guardians.get(f.person_id) ?? []);
      if (who.type === "adult") ids.add(f.person_id);
      const part = f.type === "health_c" ? "Part C" : "Parts A and B";
      add({ personIds: [...ids], category: "reminders", path: "/forms",
        subject: `${who.first_name}'s health form (${part}) expires in ${days} days. Download a blank form and give the new one to a leader.` }, "formReminders");
    }
  }

  // 3) Leaders' Youth Protection Training, 30 and 7 days out: without it they lose access to kids' private details.
  for (const days of [30, 7]) {
    const day = isoDay(new Date(now.getTime() + days * 86400000));
    const { data: lapsing } = await db.from("memberships").select("id, person_id").eq("status", "active").eq("ypt_expires", day);
    const claimed = await claimMany(db, (lapsing ?? []).map((m) => `ypt:${m.id}:${days}`));
    const ids = [...new Set((lapsing ?? []).filter((m) => claimed.has(`ypt:${m.id}:${days}`)).map((m) => m.person_id))];
    add({ personIds: ids, category: "reminders", path: "/settings",
      subject: `Your Youth Protection Training expires in ${days} days. Retake it at my.scouting.org, then update your date so you keep access to leader tools.` }, "formReminders");
  }

  // 4) Weekly digest on each person's chosen day (Sunday for adults who never chose).
  const today = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][now.getDay()];
  const { data: prefs } = await db.from("notification_prefs").select("person_id, digest_day, categories").eq("digest_day", today);
  const people = new Set((prefs ?? []).filter((p) => (p.categories as Record<string, boolean>)?.digest !== false).map((p) => p.person_id as string));
  if (today === "sun") {
    const [{ data: adults }, { data: all }] = await Promise.all([
      db.from("persons").select("id").eq("type", "adult").not("user_id", "is", null),
      db.from("notification_prefs").select("person_id"),
    ]);
    const hasPref = new Set((all ?? []).map((a) => a.person_id));
    (adults ?? []).forEach((p) => { if (!hasPref.has(p.id)) people.add(p.id); });
  }
  const claimedDigests = await claimMany(db, [...people].map((pid) => `digest:${pid}:${isoDay(now)}`));
  const digestIds = [...people].filter((pid) => claimedDigests.has(`digest:${pid}:${isoDay(now)}`));
  if (digestIds.length) {
    const { data: ms } = await db.from("memberships").select("person_id, org_id").in("person_id", digestIds).eq("status", "active");
    const orgIds = [...new Set((ms ?? []).map((m) => m.org_id))];
    const [{ data: evs }, { data: hh }] = await Promise.all([
      orgIds.length ? db.from("events").select("org_id, title, start_at").in("org_id", orgIds).eq("canceled", false)
        .gte("start_at", now.toISOString()).lt("start_at", hours(7 * 24)).order("start_at") : Promise.resolve({ data: [] }),
      db.from("household_members").select("household_id, person_id").in("person_id", digestIds).eq("is_guardian", true),
    ]);
    const hids = [...new Set((hh ?? []).map((h) => h.household_id))];
    const { data: ledger } = hids.length && orgIds.length
      ? await db.from("ledger_entries").select("household_id, org_id, amount_cents").in("household_id", hids).in("org_id", orgIds)
      : { data: [] as { household_id: string; org_id: string; amount_cents: number }[] };
    for (const pid of digestIds) {
      const myOrgs = new Set((ms ?? []).filter((m) => m.person_id === pid).map((m) => m.org_id));
      if (!myOrgs.size) continue;
      const myHh = new Set((hh ?? []).filter((h) => h.person_id === pid).map((h) => h.household_id));
      const week = (evs ?? []).filter((e) => myOrgs.has(e.org_id)).slice(0, 5);
      const owed = (ledger ?? []).filter((l) => myHh.has(l.household_id) && myOrgs.has(l.org_id)).reduce((t, l) => t + l.amount_cents, 0);
      if (!week.length && owed <= 0) continue;
      const parts: string[] = [];
      if (week.length) parts.push(`This week: ${week.map((e) => `${e.title} (${fmtDate(e.start_at, { weekday: "short", month: "short", day: "numeric" })})`).join("; ")}.`);
      if (owed > 0) parts.push(`Your family owes $${(owed / 100).toFixed(2)}.`);
      add({ personIds: [pid], category: "digest", subject: parts.join(" "), path: owed > 0 && !week.length ? "/pay" : "/dashboard" }, "digests");
    }
  }

  const { delivered } = await notifyMany(notices);
  return NextResponse.json({ ...counts, delivered });
}

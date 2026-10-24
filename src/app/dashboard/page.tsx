import Link from "next/link";
import { rsvpPrivate } from "@/lib/rsvpPrivate";
import { requireOrg, unitWord } from "@/lib/context";
import Shell from "@/components/Shell";
import { Chip, TIME_ZONE, fmtDate, fmtTime, money } from "@/components/ui";
import { householdBalance, loadFamily } from "@/lib/family";
import ScoutHome, { type ScoutEvent } from "./ScoutHome";
import { nextRankSummary } from "@/lib/advancement";

export default async function DashboardPage() {
  const ctx = await requireOrg();
  const { supabase, current, person, isLeader, householdId } = ctx;
  const orgId = current.org.id;

  // Scouts get their own simple screen: upcoming events with one-tap answers.
  if (person.type === "youth") {
    const { data: evs } = await supabase.from("events").select("id, title, start_at, end_at, location, kind, cost_cents, rsvp_deadline")
      .eq("org_id", orgId).eq("canceled", false).gte("start_at", new Date().toISOString()).order("start_at").limit(12);
    const evIds = (evs ?? []).map((e) => e.id);
    const [{ data: mine }, minePriv] = evIds.length
      ? await Promise.all([
        supabase.from("rsvps").select("event_id, status, rsvp_approval_status").eq("person_id", person.id).in("event_id", evIds),
        rsvpPrivate(supabase, { events: evIds, persons: [person.id] }),
      ])
      : [{ data: [] as { event_id: string; status: string; rsvp_approval_status: string | null }[] }, []];
    const privOf = Object.fromEntries(minePriv.map((r) => [r.event_id, r]));
    const byEvent = Object.fromEntries((mine ?? []).map((r) => [r.event_id, { ...r, notes: privOf[r.event_id]?.notes ?? null, dietary: privOf[r.event_id]?.dietary ?? null, answers: privOf[r.event_id]?.answers ?? {} }]));
    const scoutEvents: ScoutEvent[] = (evs ?? []).map((e) => {
      const r = byEvent[e.id];
      return { ...e, mine: r ? { status: r.status, notes: r.notes, dietary: r.dietary, answers: (r.answers ?? {}) as Record<string, string>, pending: r.rsvp_approval_status === "pending" } : null };
    });
    const [{ data: plc }, rank] = await Promise.all([supabase.rpc("is_plc_member", { org: orgId }), nextRankSummary(supabase, person.id)]);
    return <Shell ctx={ctx}><ScoutHome personId={person.id} firstName={person.first_name} events={scoutEvents} plc={!!plc} rank={rank} /></Shell>;
  }

  const family = await loadFamily(supabase, orgId);
  const inTroop = family.filter((f) => f.in_org);
  const ids = inTroop.map((f) => f.id);
  const scouts = inTroop.filter((p) => p.type === "youth");
  const youthIds = scouts.map((f) => f.id);

  const now = new Date().toISOString();
  const [{ data: events }, balance, { data: forms }, [{ count: joins }, { count: signoffs }], { data: pendingRows }] = await Promise.all([
    supabase.from("events").select("id, title, start_at, end_at, location, cost_cents, rsvp_deadline, kind")
      .eq("org_id", orgId).eq("canceled", false).gte("start_at", now).order("start_at").limit(8),
    householdBalance(supabase, householdId, orgId),
    ids.length ? supabase.from("forms").select("person_id, type, expires_at").eq("org_id", orgId).in("person_id", ids) : Promise.resolve({ data: [] }),
    isLeader
      ? Promise.all([
        supabase.from("join_requests").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "pending"),
        supabase.from("requirement_progress").select("*", { count: "exact", head: true }).eq("org_id", orgId).not("completed_at", "is", null).is("approved_by", null),
      ])
      : Promise.resolve([{ count: 0 }, { count: 0 }]),
    // Scouts' paid sign-ups waiting for a parent's OK (unit setting; nothing is charged until approved).
    youthIds.length
      ? supabase.from("rsvps").select("event_id, person_id, events!inner(title, cost_cents, start_at, canceled)").in("person_id", youthIds).eq("rsvp_approval_status", "pending").eq("status", "going")
          .eq("events.canceled", false).gte("events.start_at", new Date().toISOString())
      : Promise.resolve({ data: [] as { event_id: string; person_id: string; events: unknown }[] }),
  ]);

  // Trips short on drivers: youth going vs seats adults have offered (campouts and high adventure).
  const eventIds = (events ?? []).map((e) => e.id);
  const trips = (events ?? []).filter((e) => ["campout", "high_adventure"].includes(e.kind ?? ""));
  const [{ data: rsvps }, { data: tripRsvps }] = await Promise.all([
    eventIds.length && ids.length
      ? supabase.from("rsvps").select("event_id, person_id, status").in("event_id", eventIds).in("person_id", ids)
      : Promise.resolve({ data: [] as { event_id: string; person_id: string; status: string }[] }),
    trips.length
      ? supabase.from("rsvps").select("event_id, driver_seats, persons(type)").in("event_id", trips.map((e) => e.id)).eq("status", "going")
      : Promise.resolve({ data: [] as { event_id: string; driver_seats: number; persons: unknown }[] }),
  ]);

  const rsvpFor = (eventId: string) => (rsvps ?? []).filter((r) => r.event_id === eventId);
  // An event needs an answer when a Scout in the family hasn't replied; parents coming along is optional.
  const mustAnswer = youthIds.length ? youthIds : ids;
  const unanswered = (eventId: string) => mustAnswer.some((id) => !rsvpFor(eventId).some((r) => r.person_id === id));
  const needsAnswer = (events ?? []).filter((e) => unanswered(e.id));

  // Annual health record: Parts A and B are needed for every activity; expiring within 30 days counts as due.
  const soon = Date.now() + 30 * 86400000;
  const formIssues = inTroop.flatMap((p) => {
    const mine = (forms ?? []).filter((f) => f.person_id === p.id);
    const out: string[] = [];
    for (const part of ["health_ab"]) {
      const f = mine.find((x) => x.type === part);
      if (!f) out.push(`${p.first_name}: health form Parts A and B needed`);
      else if (f.expires_at && new Date(f.expires_at).getTime() < soon) out.push(`${p.first_name}: health form expires ${fmtDate(f.expires_at)}`);
    }
    return out;
  });

  const leaderTodos = [
    { label: "Families waiting to join", href: "/admin/members?tab=requests", count: joins ?? 0 },
    { label: "Requirements waiting for sign-off", href: "/admin/advancement", count: signoffs ?? 0 },
  ].filter((t) => t.count > 0);

  const next = (events ?? [])[0];
  const word = unitWord(current.org.type);

  const pendingOk = (pendingRows ?? []).map((r) => ({ ...r, ev: r.events as { title: string; cost_cents: number } | null, who: inTroop.find((f) => f.id === r.person_id)?.first_name ?? "Your Scout" }));

  const needDrivers = trips.map((e) => {
    const rs = (tripRsvps ?? []).filter((r) => r.event_id === e.id);
    const youth = rs.filter((r) => (r.persons as { type: string } | null)?.type === "youth").length;
    const seats = rs.reduce((t, r) => t + (r.driver_seats || 0), 0);
    return { e, short: youth - seats };
  }).filter((x) => x.short > 0);

  const nextAnswered = next ? !unanswered(next.id) : true;
  const todoCount = (balance > 0 ? 1 : 0) + (formIssues.length ? 1 : 0) + needsAnswer.length;
  // The server runs on UTC; greet by the unit's local hour.
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", hourCycle: "h23" }).format(new Date()));
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <Shell ctx={ctx}>
      <div>
        <h1 className="font-display font-extrabold text-[32px] leading-tight m-0">{greet}, {person.first_name}</h1>
        <p className="text-[16px] text-smoke m-0 mt-1">
          {todoCount === 0 ? "You're all caught up." : todoCount === 1 ? "One thing needs you." : `${todoCount} things need you.`}
        </p>
      </div>

      {pendingOk.map((p) => (
        <Link key={p.event_id + p.person_id} href={`/events/${p.event_id}`} className="card flex items-center gap-4 flex-wrap no-underline text-ink" style={{ background: "#FFF6D6" }}>
          <span className="flex-1 min-w-[220px] text-[16px]"><b>{p.who}</b> signed up for <b>{p.ev?.title ?? "an event"}</b>{p.ev?.cost_cents ? ` (${money(p.ev.cost_cents)})` : ""}. Nothing is charged until you say OK.</span>
          <span className="btn-primary">Review</span>
        </Link>
      ))}

      {next && (
        <Link href={`/events/${next.id}`} className="patch md:p-7 flex flex-wrap items-center gap-5 no-underline">
          <div className="flex-1 min-w-[260px] flex flex-col gap-1.5">
            <span className="eyebrow" style={{ color: "#F5B700" }}>
              Next up · {fmtDate(next.start_at, { weekday: "short", month: "short", day: "numeric" })} · {fmtTime(next.start_at)}
            </span>
            <span className="font-display font-extrabold text-[28px] leading-tight">{next.title}</span>
            <span className="text-[15px]" style={{ color: "#D7E0EE" }}>
              {[next.location, next.cost_cents > 0 ? `${money(next.cost_cents)} per person` : null, next.rsvp_deadline ? `reply by ${fmtDate(next.rsvp_deadline)}` : null].filter(Boolean).join(" · ")}
            </span>
            <div className="flex gap-2 flex-wrap mt-1">
              {inTroop.map((p) => {
                const r = rsvpFor(next.id).find((x) => x.person_id === p.id);
                const label = r?.status === "going" ? "Going" : r?.status === "not_going" ? "Not going" : r?.status === "waitlisted" ? "Waitlist" : "No reply";
                return <span key={p.id} className="text-[13px] font-bold px-3 py-1 rounded-full"
                  style={{ background: r?.status === "going" ? "#F5B700" : "rgba(255,255,255,.14)", color: r?.status === "going" ? "#101B2D" : "#FFFFFF" }}>{p.first_name}: {label}</span>;
              })}
            </div>
          </div>
          <span className="min-h-[52px] px-7 rounded-full font-bold text-[16px] flex items-center" style={{ background: "#F5B700", color: "#101B2D" }}>
            {nextAnswered ? "See details" : next.cost_cents > 0 ? "Sign up and pay" : "RSVP"}
          </span>
        </Link>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="card flex flex-col gap-1.5">
          <span className="eyebrow text-forest">You owe</span>
          <span className="font-display font-extrabold text-[34px] leading-tight" style={{ color: balance > 0 ? "#5E4400" : undefined }}>
            {balance > 0 ? money(balance) : balance < 0 ? `${money(-balance)} credit` : "$0"}
          </span>
          <span className="text-[14px] text-smoke">{balance > 0 ? `Your family balance with the ${word.toLowerCase()}.` : "Nothing due right now."}</span>
          {balance > 0 && <Link href="/pay" className="font-bold text-forest min-h-[44px] flex items-center">Pay now</Link>}
        </div>
        <div className="card flex flex-col gap-1.5">
          <span className="eyebrow text-forest">Forms</span>
          <span className="font-display font-extrabold text-[34px] leading-tight">{formIssues.length ? `${formIssues.length} needed` : "All set"}</span>
          <span className="text-[14px] text-smoke">{formIssues[0] ?? "Health forms are on file and current."}</span>
          {formIssues.length > 0 && <Link href="/forms" className="font-bold text-forest min-h-[44px] flex items-center">Get the blank form</Link>}
        </div>
        <div className="card flex flex-col gap-1.5">
          <span className="eyebrow text-forest">{leaderTodos.length ? "Leader to-dos" : "Ways to help"}</span>
          {leaderTodos.length ? (
            <>
              <span className="font-display font-extrabold text-[34px] leading-tight">{leaderTodos.reduce((t, x) => t + x.count, 0)}</span>
              {leaderTodos.map((t) => <Link key={t.href} href={t.href} className="text-[14px] text-forest font-bold min-h-[32px] flex items-center">{t.count} · {t.label}</Link>)}
            </>
          ) : (
            <>
              {needDrivers.length ? (
                <>
                  <span className="font-display font-extrabold text-[34px] leading-tight">Drivers needed</span>
                  <span className="text-[14px] text-smoke">{needDrivers[0].e.title}: {needDrivers[0].short} more seat{needDrivers[0].short === 1 ? "" : "s"} needed.</span>
                  <Link href={`/events/${needDrivers[0].e.id}`} className="font-bold text-forest min-h-[44px] flex items-center">Offer seats</Link>
                </>
              ) : (
                <>
                  <span className="font-display font-extrabold text-[34px] leading-tight">Pitch in</span>
                  <span className="text-[14px] text-smoke">Drive, staff a booth or vote in a troop poll.</span>
                  <Link href="/volunteer" className="font-bold text-forest min-h-[44px] flex items-center">See how to help</Link>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-5">
        <section className="card flex-[1_1_420px] min-w-0 flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <span className="eyebrow text-forest">Calendar</span>
            <Link href="/events" className="text-[14px] font-bold text-forest min-h-[44px] flex items-center">All events</Link>
          </div>
          {(events ?? []).length === 0 && <span className="text-smoke text-[14px] py-3">{isLeader ? "No events yet. Add your first one from Events." : "No events on the calendar yet."}</span>}
          {(events ?? []).slice(0, 6).map((e) => {
            const open = unanswered(e.id);
            return (
              <Link key={e.id} href={`/events/${e.id}`} className="flex items-center gap-4 min-h-[56px] border-t border-[#EAE4D6] no-underline text-ink">
                <span className="w-16 font-bold text-forest text-[14px]">{fmtDate(e.start_at, { month: "short", day: "numeric" })}</span>
                <span className="flex-1 font-bold text-[15px] truncate">{e.title}</span>
                {open ? <Chip tone="orange">Not answered</Chip> : <span className="text-[14px] text-smoke">{fmtTime(e.start_at)}</span>}
              </Link>
            );
          })}
        </section>

        {scouts.length > 0 && (
          <section className="card flex-[1_1_300px] min-w-0 flex flex-col gap-3">
            <span className="eyebrow text-forest">My Scouts</span>
            {scouts.map((p) => (
              <Link key={p.id} href={`/scout/${p.id}/advancement`} className="flex items-center gap-3 no-underline text-ink min-h-[52px]">
                <span className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-[14px] flex-none" style={{ background: "#D7E0EE", color: "#12355F" }}>
                  {p.first_name[0]}{p.last_name?.[0] ?? ""}
                </span>
                <span className="flex-1 font-bold text-[15px]">{p.first_name}</span>
                <span className="text-[14px] font-bold text-forest">Ranks and badges</span>
              </Link>
            ))}
            {current.role === "merit_badge_counselor" && (
              <Link href="/counselor" className="font-bold text-forest min-h-[44px] flex items-center border-t border-[#EAE4D6]">Merit badge counselor tools</Link>
            )}
          </section>
        )}
      </div>
    </Shell>
  );
}

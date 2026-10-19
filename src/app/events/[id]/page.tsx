import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/context";
import Shell from "@/components/Shell";
import { Chip, SectionLabel, fmtDate, fmtTime, money } from "@/components/ui";
import { loadFamily } from "@/lib/family";
import RsvpPanel, { type RsvpRow } from "./RsvpPanel";
import LeaderEventTools from "./LeaderEventTools";

type Roster = { person_id: string; role: string; ypt_expires: string | null; persons: { first_name: string; last_name: string; type: string } };

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrg();
  const { supabase, current, isLeader, can } = ctx;
  const seesForms = can("medical.view", "medical.record");
  const orgId = current.org.id;

  const { data: ev } = await supabase.from("events").select("*").eq("id", id).eq("org_id", orgId).maybeSingle();
  if (!ev) notFound();

  const { data: tripPlan } = await supabase.from("trip_plans").select("itinerary, packing").eq("event_id", id).maybeSingle();
  const packing = ((tripPlan?.packing ?? []) as { id: string; text: string }[]);
  const itinerary = ((tripPlan?.itinerary ?? []) as { id: string; day?: string; time?: string; text: string }[]);

  const [{ data: rsvps }, { data: roster }, { data: patrolRows }, family, { data: orgForms }, { data: ageFlags }] = await Promise.all([
    supabase.from("rsvps").select("person_id, status, notes, driver_seats, dietary, answers").eq("event_id", id),
    supabase.from("memberships").select("person_id, role, ypt_expires, persons(first_name, last_name, type)").eq("org_id", orgId).eq("status", "active"),
    supabase.from("patrol_members").select("person_id, patrols(name)").eq("org_id", orgId).is("end_date", null),
    loadFamily(supabase, orgId),
    seesForms ? supabase.from("forms").select("person_id, type, expires_at").eq("org_id", orgId) : Promise.resolve({ data: [] as { person_id: string; type: string; expires_at: string | null }[] }),
    supabase.rpc("member_age_flags", { p_org: orgId, p_on: ev.start_at.slice(0, 10) }),
  ]);
  const over21 = new Set(((ageFlags ?? []) as { person_id: string; adult_21: boolean }[]).filter((a) => a.adult_21).map((a) => a.person_id));

  const people = (roster ?? []) as unknown as Roster[];
  const patrolOf = Object.fromEntries((patrolRows ?? []).map((p) => [p.person_id, (p.patrols as unknown as { name: string })?.name]));
  const byPerson = Object.fromEntries((rsvps ?? []).map((r) => [r.person_id, r]));
  const name = (pid: string) => { const p = people.find((x) => x.person_id === pid)?.persons; return p ? `${p.first_name} ${p.last_name}` : "Member"; };

  const going = people.filter((p) => byPerson[p.person_id]?.status === "going");
  const waitlist = people.filter((p) => byPerson[p.person_id]?.status === "waitlisted");
  const notGoing = people.filter((p) => byPerson[p.person_id]?.status === "not_going");
  const noReply = people.filter((p) => !byPerson[p.person_id]);

  // Youth protection (Scouting America): two registered adults 21 or older on every youth activity,
  // every adult with current Youth Protection Training. Ages come as a yes/no flag so nobody's
  // birthdate leaves the database (an adult with no birthdate on file counts as 21+, as before).
  const adultsGoing = going.filter((p) => p.persons.type === "adult" && over21.has(p.person_id));
  const trainedLeaders = adultsGoing.filter((p) => p.ypt_expires && new Date(p.ypt_expires) > new Date(ev.end_at ?? ev.start_at));

  // Health record: Parts A and B for every activity; Part C (physician exam) for events over 72 hours
  // or high adventure. Forms must be valid through the end of the event.
  const endAt = new Date(ev.end_at ?? ev.start_at);
  const needsC = (ev.end_at && endAt.getTime() - new Date(ev.start_at).getTime() > 72 * 3600000) || ev.kind === "high_adventure";
  const formValid = (pid: string, t: string) => (orgForms ?? []).some((f) => f.person_id === pid && f.type === t && (!f.expires_at || new Date(f.expires_at) >= endAt));
  const readiness = going.map((p) => ({
    p,
    missing: [
      !formValid(p.person_id, "health_ab") && "Health A+B",
      needsC && !formValid(p.person_id, "health_c") && "Health C",
      ev.needs_permission && p.persons.type === "youth" && !formValid(p.person_id, "permission") && "Permission",
      p.persons.type === "adult" && !(p.ypt_expires && new Date(p.ypt_expires) > endAt) && "YPT",
    ].filter(Boolean) as string[],
  })).filter((r) => r.missing.length);
  const youthGoing = going.filter((p) => p.persons.type === "youth");
  const ratioOk = youthGoing.length === 0 || (adultsGoing.length >= 2 && trainedLeaders.length >= 2);
  const seats = going.reduce((s, p) => s + (byPerson[p.person_id]?.driver_seats ?? 0), 0);

  const multi = ev.end_at && new Date(ev.end_at).toDateString() !== new Date(ev.start_at).toDateString();
  const myFamily = family.filter((f) => f.in_org);
  const famRsvps: RsvpRow[] = myFamily.map((f) => ({
    person_id: f.id, first_name: f.first_name, type: f.type,
    status: byPerson[f.id]?.status ?? null, notes: byPerson[f.id]?.notes ?? "", dietary: byPerson[f.id]?.dietary ?? "",
    driver_seats: byPerson[f.id]?.driver_seats ?? 0, answers: (byPerson[f.id]?.answers ?? {}) as Record<string, string>,
  }));

  const List = ({ title, list, tone }: { title: string; list: Roster[]; tone: "green" | "gray" | "orange" }) => (
    <div className="card flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-bold text-[15px]">{title}</span>
        <Chip tone={tone}>{list.length}</Chip>
      </div>
      {list.length === 0 ? <span className="text-[14px] text-smoke">Nobody yet</span> : (
        <div className="flex flex-col">
          {list.map((p) => {
            const r = byPerson[p.person_id];
            return (
              <div key={p.person_id} className="flex items-center gap-2 py-1.5 border-b border-[#EAF0ED] last:border-0 text-[14px]">
                <span className="font-bold">{p.persons.first_name} {p.persons.last_name}</span>
                {p.persons.type === "adult" && <Chip>Adult</Chip>}
                {patrolOf[p.person_id] && <span className="text-smoke">{patrolOf[p.person_id]}</span>}
                {isLeader && r?.driver_seats ? <Chip tone="green">Driving · {r.driver_seats} seats</Chip> : null}
                {isLeader && r?.dietary ? <Chip tone="orange">{r.dietary}</Chip> : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <Shell ctx={ctx}>
      <div className="flex flex-col gap-2">
        <Link href="/events" className="text-[13px] font-bold text-forest no-underline">← Events</Link>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display font-extrabold text-[28px] leading-tight m-0">{ev.title}</h1>
            <div className="text-[15px] text-smoke mt-1">
              {multi ? `${fmtDate(ev.start_at, { weekday: "short", month: "short", day: "numeric" })} – ${fmtDate(ev.end_at, { weekday: "short", month: "short", day: "numeric" })}`
                : `${fmtDate(ev.start_at, { weekday: "long", month: "long", day: "numeric" })} · ${fmtTime(ev.start_at)}`}
              {ev.location ? ` · ${ev.location}` : ""}
            </div>
          </div>
          {ev.canceled && <Chip tone="red">Canceled</Chip>}
        </div>
        <div className="flex gap-2 flex-wrap">
          {ev.cost_cents > 0 ? <Chip tone="orange">{money(ev.cost_cents)} per person</Chip> : <Chip tone="green">Free</Chip>}
          {ev.cap && <Chip>{going.length} of {ev.cap} spots taken</Chip>}
          {ev.rsvp_deadline && <Chip>Reply by {fmtDate(ev.rsvp_deadline)} {fmtTime(ev.rsvp_deadline)}</Chip>}
          {ev.needs_permission && <Chip tone="orange">Permission slip</Chip>}
        </div>
        {ev.description && <p className="text-[15px] m-0 whitespace-pre-wrap">{ev.description}</p>}
        <p className="text-[13px] text-smoke m-0">
          {ev.cost_cents > 0 && (ev.refund_rule === "full" ? "Cancel any time for a full credit to your family balance."
            : ev.refund_rule === "partial" ? "Cancel before the deadline for a full credit; after it, half."
            : "Cancel before the deadline for a full credit; after it, no credit.")}
        </p>
      </div>

      {!ev.canceled && myFamily.length > 0 && (
        <RsvpPanel eventId={ev.id} costCents={ev.cost_cents} questions={(ev.questions ?? []) as string[]} family={famRsvps} />
      )}

      {(itinerary.length > 0 || packing.length > 0) && (
        <section className="grid md:grid-cols-2 gap-3">
          {itinerary.length > 0 && (
            <div className="card flex flex-col gap-1">
              <div className="font-bold text-[15px]">Schedule</div>
              {itinerary.map((i) => <div key={i.id} className="text-[14px]"><b>{[i.day, i.time].filter(Boolean).join(" ")}</b> {i.text}</div>)}
            </div>
          )}
          {packing.length > 0 && (
            <div className="card flex flex-col gap-1">
              <div className="font-bold text-[15px]">What to bring</div>
              <ul className="m-0 pl-5 text-[14px]">{packing.map((p) => <li key={p.id}>{p.text}</li>)}</ul>
            </div>
          )}
        </section>
      )}

      {seesForms && going.length > 0 && (
        <section className="card flex flex-col gap-2" style={{ borderColor: readiness.length ? "#FFD6B8" : "#CFE3DA" }}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-[15px]">Ready to go?</span>
            <Chip tone={readiness.length ? "orange" : "green"}>{readiness.length ? `${readiness.length} not ready` : "Everyone ready"}</Chip>
          </div>
          {needsC && <div className="text-[13px] text-smoke">Over 72 hours or high adventure: everyone needs Part C (physician exam) too.</div>}
          {readiness.map((r) => (
            <div key={r.p.person_id} className="flex items-center gap-2 flex-wrap text-[14px]">
              <b>{r.p.persons.first_name} {r.p.persons.last_name}</b>
              {r.missing.map((m) => <Chip key={m} tone="orange">Needs {m}</Chip>)}
            </div>
          ))}
        </section>
      )}

      {isLeader && (
        <LeaderEventTools eventId={ev.id} canceled={ev.canceled} ratioOk={ratioOk}
          adults={adultsGoing.length} trained={trainedLeaders.length} youth={youthGoing.length} seats={seats}
          noReply={noReply.length} />
      )}

      <section className="flex flex-col gap-2">
        <SectionLabel>Who&apos;s going</SectionLabel>
        <div className="grid md:grid-cols-3 gap-3">
          <List title="Going" list={going} tone="green" />
          <List title="Not going" list={notGoing} tone="gray" />
          <List title="Hasn't responded" list={noReply} tone="orange" />
        </div>
        {waitlist.length > 0 && <List title="Waitlist" list={waitlist} tone="orange" />}
        {isLeader && going.some((p) => byPerson[p.person_id]?.notes) && (
          <div className="card flex flex-col gap-1">
            <div className="font-bold text-[15px]">Notes from families (leaders only)</div>
            {going.filter((p) => byPerson[p.person_id]?.notes).map((p) => (
              <div key={p.person_id} className="text-[14px]"><b>{name(p.person_id)}:</b> {byPerson[p.person_id]?.notes}</div>
            ))}
          </div>
        )}
      </section>
    </Shell>
  );
}

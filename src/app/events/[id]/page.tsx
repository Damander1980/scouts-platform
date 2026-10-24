import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/context";
import Shell from "@/components/Shell";
import { Chip, SectionLabel, fmtDate, fmtTime, isoDay, money } from "@/components/ui";
import { loadFamily } from "@/lib/family";
import { rsvpPrivate } from "@/lib/rsvpPrivate";
import RsvpPanel, { type RsvpRow } from "./RsvpPanel";
import LeaderEventTools from "./LeaderEventTools";

type Roster = { person_id: string; role: string; ypt_expires: string | null; persons: { first_name: string; last_name: string; type: string } };

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrg();
  const { supabase, current, isLeader, can } = ctx;
  const seesForms = can("medical.view", "medical.record");
  const orgId = current.org.id;

  // Our own event, or one a linked unit shared with us (then we're guests: sign up, no roster).
  const { data: ev } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (!ev) notFound();
  const guest = ev.org_id !== orgId;
  const { data: hostRow } = guest
    ? await supabase.rpc("linked_units", { p_org: orgId }).then((r) => ({ data: ((r.data ?? []) as { org_id: string; name: string }[]).find((l) => l.org_id === ev.org_id) }))
    : { data: undefined };

  const { data: tripPlan } = await supabase.from("trip_plans").select("itinerary, packing").eq("event_id", id).maybeSingle();
  const packing = ((tripPlan?.packing ?? []) as { id: string; text: string }[]);
  const itinerary = ((tripPlan?.itinerary ?? []) as { id: string; day?: string; time?: string; text: string }[]);

  const [{ data: rsvps }, { data: roster }, { data: patrolRows }, family, { data: orgForms }, { data: ageFlags }] = await Promise.all([
    supabase.from("rsvps").select("person_id, status, driver_seats, rsvp_approval_status").eq("event_id", id),
    supabase.from("memberships").select("person_id, role, ypt_expires, persons(first_name, last_name, type)").eq("org_id", orgId).eq("status", "active"),
    supabase.from("patrol_members").select("person_id, patrols(name)").eq("org_id", orgId).is("end_date", null),
    loadFamily(supabase, orgId),
    seesForms ? supabase.from("forms").select("person_id, type, expires_at").eq("org_id", orgId) : Promise.resolve({ data: [] as { person_id: string; type: string; expires_at: string | null }[] }),
    supabase.rpc("member_age_flags", { p_org: orgId, p_on: isoDay(new Date(ev.start_at)) }),
  ]);
  // What actually happened, once a leader has taken attendance (unconfirmed QR check-ins don't count yet).
  const { data: attRows } = !guest && isLeader
    ? await supabase.from("attendance").select("person_id, present, confirmed, method").eq("event_id", id)
    : { data: [] as { person_id: string; present: boolean; confirmed: boolean | null; method: string | null }[] };
  const { data: guestRows } = !guest && isLeader ? await supabase.rpc("event_guests", { p_event: id }) : { data: [] };
  const guests = (guestRows ?? []) as { person_id: string; first_name: string; last_name: string; type: string; unit_name: string; status: string; driver_seats: number; dietary: string | null }[];
  const over21 = new Set(((ageFlags ?? []) as { person_id: string; adult_21: boolean }[]).filter((a) => a.adult_21).map((a) => a.person_id));

  const people = (roster ?? []) as unknown as Roster[];
  const patrolOf = Object.fromEntries((patrolRows ?? []).map((p) => [p.person_id, (p.patrols as unknown as { name: string })?.name]));
  // Notes, allergies and answers: the viewer's own family, or every row for the event's leaders.
  const priv = Object.fromEntries((await rsvpPrivate(supabase, { events: [id] })).map((r) => [r.person_id, r]));
  const byPerson = Object.fromEntries((rsvps ?? []).map((r) => [r.person_id, { ...r, notes: priv[r.person_id]?.notes ?? null, dietary: priv[r.person_id]?.dietary ?? null, answers: priv[r.person_id]?.answers ?? {} }]));
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

  const multi = ev.end_at && isoDay(new Date(ev.end_at)) !== isoDay(new Date(ev.start_at));
  const myFamily = family.filter((f) => f.in_org);
  // Carry each family member's latest allergy/dietary note into a new sign-up so nobody retypes it.
  const needNote = myFamily.filter((f) => !byPerson[f.id]?.dietary).map((f) => f.id);
  const { data: priorNotes } = needNote.length
    ? { data: (await rsvpPrivate(supabase, { persons: needNote })).filter((r) => r.dietary).slice(0, 50) }
    : { data: [] as { person_id: string; dietary: string | null }[] };
  const lastNote = new Map<string, string>();
  for (const r of priorNotes ?? []) if (r.dietary?.trim() && !lastNote.has(r.person_id)) lastNote.set(r.person_id, r.dietary.trim());

  const famRsvps: RsvpRow[] = myFamily.map((f) => ({
    person_id: f.id, first_name: f.first_name, type: f.type,
    status: byPerson[f.id]?.status ?? null, notes: byPerson[f.id]?.notes ?? "", dietary: byPerson[f.id]?.dietary || lastNote.get(f.id) || "",
    driver_seats: byPerson[f.id]?.driver_seats ?? 0, answers: (byPerson[f.id]?.answers ?? {}) as Record<string, string>,
    pending: byPerson[f.id]?.rsvp_approval_status === "pending",
  }));

  const marked = (attRows ?? []).filter((a) => !a.present || a.confirmed !== false || (a.method ?? "") !== "qr");
  const attended = new Set(marked.filter((a) => a.present).map((a) => a.person_id));
  const absent = new Set(marked.filter((a) => !a.present).map((a) => a.person_id));
  const rsvpOf = (pid: string) => byPerson[pid]?.status as string | undefined;
  const actual = {
    asPlanned: going.filter((p) => attended.has(p.person_id)),
    noShows: going.filter((p) => absent.has(p.person_id)),
    unmarked: going.filter((p) => !attended.has(p.person_id) && !absent.has(p.person_id)),
    walkIns: people.filter((p) => attended.has(p.person_id) && !rsvpOf(p.person_id)),
    cameAnyway: people.filter((p) => attended.has(p.person_id) && rsvpOf(p.person_id) === "not_going"),
  };

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
              <div key={p.person_id} className="flex items-center gap-2 py-1.5 border-b border-[#EEE8D9] last:border-0 text-[14px]">
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
      <Link href="/events" className="text-[14px] font-bold text-forest no-underline min-h-[32px] flex items-center">← Events</Link>
      <div className="patch md:p-7 flex flex-col gap-3">
        <span className="eyebrow" style={{ color: "#F5B700" }}>
          {multi ? `${fmtDate(ev.start_at, { weekday: "short", month: "short", day: "numeric" })} – ${fmtDate(ev.end_at, { weekday: "short", month: "short", day: "numeric" })}`
            : `${fmtDate(ev.start_at, { weekday: "long", month: "long", day: "numeric" })} · ${fmtTime(ev.start_at)}`}
          {ev.location ? ` · ${ev.location}` : ""}
        </span>
        <div className="flex items-start gap-3 flex-wrap">
          <h1 className="font-display font-extrabold text-[34px] leading-tight m-0 flex-1">{ev.title}</h1>
          {ev.canceled && <Chip tone="red">Canceled</Chip>}
          {guest && <span className="text-[13px] font-bold px-3 py-1 rounded-full" style={{ background: "rgba(255,255,255,.14)" }}>Hosted by {hostRow?.name ?? "a linked unit"}</span>}
        </div>
        <div className="flex gap-2 flex-wrap text-[13px] font-bold">
          <span className="px-3 py-1 rounded-full" style={{ background: "#F5B700", color: "#101B2D" }}>{ev.cost_cents > 0 ? `${money(ev.cost_cents)} per person` : "Free"}</span>
          {ev.cap && <span className="px-3 py-1 rounded-full" style={{ background: "rgba(255,255,255,.14)" }}>{going.length} of {ev.cap} spots taken</span>}
          {ev.rsvp_deadline && <span className="px-3 py-1 rounded-full" style={{ background: "rgba(255,255,255,.14)" }}>Reply by {fmtDate(ev.rsvp_deadline)} {fmtTime(ev.rsvp_deadline)}</span>}
          {ev.needs_permission && <span className="px-3 py-1 rounded-full" style={{ background: "rgba(255,255,255,.14)" }}>Permission slip needed</span>}
          {ev.location && (
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.location)}`} target="_blank" rel="noopener noreferrer"
              className="px-3 py-1 rounded-full no-underline text-white" style={{ background: "rgba(255,255,255,.14)" }}>Directions ↗</a>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <div className="flex flex-col gap-5 min-w-0">
          {ev.description && <div className="card text-[15px] whitespace-pre-wrap">{ev.description}</div>}
          {!ev.canceled && myFamily.length > 0 && (
            <RsvpPanel eventId={ev.id} canApprove={ctx.person.type === "adult"} costCents={ev.cost_cents} questions={(ev.questions ?? []) as string[]} family={famRsvps} />
          )}
        </div>
        <aside className="card flex flex-col gap-3 lg:sticky lg:top-24">
          <span className="font-display font-extrabold text-[22px]">{ev.cost_cents > 0 ? "Your total" : "Your family"}</span>
          {famRsvps.length === 0 && <span className="text-[14px] text-smoke">Nobody in your family is in this unit yet.</span>}
          {famRsvps.map((f) => (
            <div key={f.person_id} className="flex justify-between text-[15px]">
              <span>{f.first_name}</span>
              <span className="text-smoke">{f.pending ? "Needs your OK" : f.status === "going" ? (ev.cost_cents > 0 ? money(ev.cost_cents) : "Going") : f.status === "not_going" ? "Not going" : f.status === "waitlisted" ? "Waitlist" : "No reply"}</span>
            </div>
          ))}
          {ev.cost_cents > 0 && (
            <>
              <div className="flex justify-between items-baseline border-t border-[#EAE4D6] pt-3">
                <span className="font-bold">Added to your balance</span>
                <span className="font-display font-extrabold text-[28px]">{money(famRsvps.filter((f) => f.status === "going" && !f.pending).length * ev.cost_cents)}</span>
              </div>
              {famRsvps.some((f) => f.status === "going" && !f.pending) && <Link href="/pay" className="btn-primary no-underline">Pay now</Link>}
              <span className="text-[13px] text-smoke">
                {ev.refund_rule === "full" ? "Cancel any time for a full credit to your family balance."
                  : ev.refund_rule === "partial" ? "Cancel before the deadline for a full credit; after it, half."
                  : "Cancel before the deadline for a full credit; after it, no credit."}
              </span>
            </>
          )}
          <a href={`/api/events/${ev.id}/ics`} className="text-[14px] font-bold text-forest min-h-[44px] flex items-center border-t border-[#EAE4D6]">Add to my calendar</a>
        </aside>
      </div>

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

      {guest && (
        <p className="text-[13px] text-smoke m-0">
          You&apos;re signing up as a guest from your own unit. Any cost goes on your family&apos;s account with {current.org.name}, which settles with {hostRow?.name ?? "the host unit"}.
        </p>
      )}

      {!guest && seesForms && going.length > 0 && (
        <section className="card flex flex-col gap-2" style={{ borderColor: readiness.length ? "#F0DA8C" : "#D7E0EE" }}>
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

      {!guest && isLeader && marked.length > 0 && new Date(ev.start_at) <= new Date() && (
        <section className="card flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-bold text-[15px]">RSVP vs who came</span>
            <Chip tone="green">{attended.size} attended · {going.length} said going</Chip>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[14px]">
            <div><div className="font-display font-extrabold text-[24px]">{actual.asPlanned.length}</div>Came as planned</div>
            <div><div className="font-display font-extrabold text-[24px]" style={{ color: actual.noShows.length ? "#8A1F1F" : undefined }}>{actual.noShows.length}</div>No-shows</div>
            <div><div className="font-display font-extrabold text-[24px]">{actual.walkIns.length}</div>Walk-ins</div>
            <div><div className="font-display font-extrabold text-[24px]">{actual.cameAnyway.length}</div>Came anyway</div>
          </div>
          {actual.unmarked.length > 0 && <div className="text-[13px] text-smoke">{actual.unmarked.length} who said going {actual.unmarked.length === 1 ? "hasn't" : "haven't"} been marked yet.</div>}
          {([["No-shows", actual.noShows], ["Walk-ins", actual.walkIns], ["Came anyway", actual.cameAnyway]] as const).filter(([, l]) => l.length).map(([label, l]) => (
            <div key={label} className="text-[14px]"><b>{label}:</b> {l.map((p) => `${p.persons.first_name} ${p.persons.last_name}`).join(", ")}</div>
          ))}
          <div className="text-[12px] text-smoke">Charges and sign-ups aren&apos;t changed by attendance.</div>
        </section>
      )}

      {!guest && isLeader && (
        <LeaderEventTools eventId={ev.id} canceled={ev.canceled} ratioOk={ratioOk}
          adults={adultsGoing.length} trained={trainedLeaders.length} youth={youthGoing.length} seats={seats}
          noReply={noReply.length} />
      )}

      {!guest && <section className="flex flex-col gap-2">
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
        {guests.length > 0 && (
          <div className="card flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[15px]">From linked units</span>
              <Chip tone="green">{guests.filter((g) => g.status === "going").length} going</Chip>
            </div>
            {guests.map((g) => (
              <div key={g.person_id} className="flex items-center gap-2 py-1.5 border-b border-[#EEE8D9] last:border-0 text-[14px] flex-wrap">
                <span className="font-bold">{g.first_name} {g.last_name}</span>
                <span className="text-smoke">{g.unit_name}</span>
                {g.type === "adult" && <Chip>Adult</Chip>}
                <Chip tone={g.status === "going" ? "green" : g.status === "waitlisted" ? "orange" : "gray"}>{g.status === "going" ? "Going" : g.status === "waitlisted" ? "Waitlist" : "Not going"}</Chip>
                {g.driver_seats ? <Chip tone="green">Driving · {g.driver_seats} seats</Chip> : null}
                {g.dietary ? <Chip tone="orange">{g.dietary}</Chip> : null}
              </div>
            ))}
          </div>
        )}
      </section>}
    </Shell>
  );
}

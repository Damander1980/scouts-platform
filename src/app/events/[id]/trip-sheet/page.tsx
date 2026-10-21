import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePerm } from "@/lib/context";
import PrintButton from "@/components/PrintButton";
import type { Plan } from "../plan/TripPlanClient";

// Printable trip sheet. Scouting America retired the old tour permit / tour plan in 2019;
// this sheet carries what leaders still need on paper: details, itinerary, who is going,
// drivers, health form status, YPT, two-deep leadership and the SAFE checklist.
// Health form status only shows for people allowed to see it (row security filters forms).

type Going = { person_id: string; driver_seats: number; dietary: string | null; persons: { first_name: string; last_name: string; type: string } };

export default async function TripSheet({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Shows health form status for every attendee, so it sits behind leader two-step sign-in too.
  const ctx = await requirePerm("leader", "events.manage");
  const { supabase, current } = ctx;
  const orgId = current.org.id;

  const { data: ev } = await supabase.from("events").select("id, title, description, location, start_at, end_at").eq("id", id).eq("org_id", orgId).maybeSingle();
  if (!ev) notFound();

  const [{ data: plan }, { data: going }, { data: forms }, { data: ms }, { data: pm }, { data: canMedical }] = await Promise.all([
    supabase.from("trip_plans").select("itinerary, permits").eq("event_id", id).maybeSingle(),
    supabase.from("rsvps").select("person_id, driver_seats, dietary, persons(first_name, last_name, type)").eq("event_id", id).eq("status", "going"),
    supabase.from("forms").select("person_id, type, expires_at").eq("org_id", orgId),
    supabase.from("memberships").select("person_id, ypt_expires").eq("org_id", orgId),
    supabase.from("patrol_members").select("person_id, patrols(name)").eq("org_id", orgId).is("end_date", null),
    supabase.rpc("has_perm", { org: orgId, perm: "medical.view" }),
  ]);

  const rows = ((going ?? []) as unknown as Going[]).sort((a, b) => a.persons.last_name.localeCompare(b.persons.last_name));
  const youth = rows.filter((r) => r.persons.type === "youth");
  const adults = rows.filter((r) => r.persons.type === "adult");
  const tripDay = new Date(ev.end_at ?? ev.start_at);
  const yptOf = Object.fromEntries((ms ?? []).map((m) => [m.person_id, m.ypt_expires as string | null]));
  const yptOk = (pid: string) => { const d = yptOf[pid]; return !!d && new Date(d + "T23:59:59") >= tripDay; };
  const patrolOf = Object.fromEntries((pm ?? []).map((p) => [p.person_id, (p.patrols as unknown as { name: string } | null)?.name ?? ""]));
  const showForms = !!canMedical;
  const form = (pid: string, t: string) => {
    const f = (forms ?? []).find((x) => x.person_id === pid && x.type === t);
    if (!f) return "Needed";
    return !f.expires_at || new Date(f.expires_at) >= tripDay ? "On file" : "Expires before trip";
  };

  const trainedAdults = adults.filter((a) => yptOk(a.person_id)).length;
  const twoDeep = trainedAdults >= 2;
  const seats = rows.reduce((s, r) => s + (r.driver_seats || 0), 0);
  const drivers = rows.filter((r) => r.driver_seats > 0);
  const p = (plan as Pick<Plan, "itinerary" | "permits"> | null) ?? { itinerary: [], permits: [] };
  const when = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  const cell = "border px-2 py-1 text-left";
  const bd = { borderColor: "#DDD6C5" };

  return (
    <div className="bg-white text-ink min-h-screen p-6 md:p-10 max-w-4xl mx-auto flex flex-col gap-5 text-[14px]">
      <div className="flex gap-2 print:hidden">
        <Link href={`/events/${id}`} className="btn-secondary no-underline">← Back to event</Link>
        <PrintButton />
      </div>
      <div className="text-[12px] text-smoke print:hidden">Open this page once on your phone before you leave and it will open at camp without signal.</div>

      <div>
        <div className="font-bold text-smoke">{current.org.name}</div>
        <h1 className="font-display font-extrabold text-[28px] m-0">Trip sheet: {ev.title}</h1>
        <div>{when(ev.start_at)}{ev.end_at ? ` to ${when(ev.end_at)}` : ""}</div>
        {ev.location && <div>{ev.location}</div>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card"><div className="text-[11px] font-bold uppercase tracking-widest text-smoke">Scouts</div><div className="font-extrabold text-[22px]">{youth.length}</div></div>
        <div className="card"><div className="text-[11px] font-bold uppercase tracking-widest text-smoke">Adults</div><div className="font-extrabold text-[22px]">{adults.length}</div></div>
        <div className="card"><div className="text-[11px] font-bold uppercase tracking-widest text-smoke">Seats offered</div><div className="font-extrabold text-[22px]" style={{ color: seats < rows.length ? "#A52A1C" : undefined }}>{seats} / {rows.length}</div></div>
        <div className="card"><div className="text-[11px] font-bold uppercase tracking-widest text-smoke">Two-deep</div><div className="font-extrabold text-[22px]" style={{ color: twoDeep ? "#12355F" : "#A52A1C" }}>{twoDeep ? "Yes" : "No"}</div></div>
      </div>
      {!twoDeep && <div className="card font-bold" style={{ background: "#FFF6D6", color: "#5E4400" }}>
        Only {trainedAdults} adult{trainedAdults === 1 ? "" : "s"} going {trainedAdults === 1 ? "has" : "have"} YPT current through the trip. Two-deep leadership needs at least two registered adults with current YPT, one of them 21 or older.
      </div>}

      {p.itinerary?.length > 0 && (
        <section className="break-inside-avoid">
          <h2 className="font-bold text-[16px] mb-1">Itinerary</h2>
          {p.itinerary.map((i) => <div key={i.id}>{[i.day, i.time].filter(Boolean).join(" ")}{i.day || i.time ? " · " : ""}{i.text}</div>)}
        </section>
      )}

      <section>
        <h2 className="font-bold text-[16px] mb-1">Scouts going ({youth.length})</h2>
        <table className="w-full border-collapse">
          <thead><tr><th className={cell} style={bd}>Name</th><th className={cell} style={bd}>Patrol</th>{showForms && <><th className={cell} style={bd}>Health A+B</th><th className={cell} style={bd}>Health C</th></>}<th className={cell} style={bd}>Diet</th></tr></thead>
          <tbody>{youth.map((r) => (
            <tr key={r.person_id}><td className={cell} style={bd}>{r.persons.first_name} {r.persons.last_name}</td><td className={cell} style={bd}>{patrolOf[r.person_id]}</td>
              {showForms && <><td className={cell} style={bd}>{form(r.person_id, "health_ab")}</td><td className={cell} style={bd}>{form(r.person_id, "health_c")}</td></>}
              <td className={cell} style={bd}>{r.dietary ?? ""}</td></tr>
          ))}</tbody>
        </table>
      </section>

      <section>
        <h2 className="font-bold text-[16px] mb-1">Adults going ({adults.length})</h2>
        <table className="w-full border-collapse">
          <thead><tr><th className={cell} style={bd}>Name</th><th className={cell} style={bd}>YPT through trip</th>{showForms && <><th className={cell} style={bd}>Health A+B</th><th className={cell} style={bd}>Health C</th></>}<th className={cell} style={bd}>Driving (seats)</th></tr></thead>
          <tbody>{adults.map((r) => (
            <tr key={r.person_id}><td className={cell} style={bd}>{r.persons.first_name} {r.persons.last_name}</td>
              <td className={cell} style={bd}>{yptOk(r.person_id) ? `Yes (${yptOf[r.person_id]})` : yptOf[r.person_id] ? `Expired ${yptOf[r.person_id]}` : "Not entered"}</td>
              {showForms && <><td className={cell} style={bd}>{form(r.person_id, "health_ab")}</td><td className={cell} style={bd}>{form(r.person_id, "health_c")}</td></>}
              <td className={cell} style={bd}>{r.driver_seats || ""}</td></tr>
          ))}</tbody>
        </table>
      </section>

      {drivers.length > 0 && (
        <section className="break-inside-avoid">
          <h2 className="font-bold text-[16px] mb-1">Drivers</h2>
          {drivers.map((d) => <div key={d.person_id}>{d.persons.first_name} {d.persons.last_name}: {d.driver_seats} seat{d.driver_seats === 1 ? "" : "s"}</div>)}
        </section>
      )}

      <section className="break-inside-avoid">
        <h2 className="font-bold text-[16px] mb-1">SAFE checklist and permits</h2>
        {(p.permits?.length ? p.permits : []).map((i) => <div key={i.id}>{i.done ? "[x]" : "[ ]"} {i.text}</div>)}
        {!p.permits?.length && <div className="text-smoke">No checklist yet. Open the trip plan to start one.</div>}
      </section>

      {!showForms && <div className="text-[12px] text-smoke">Health form columns are hidden because your position cannot see health form status.</div>}
      <div className="text-[12px] text-smoke">Completed health forms stay on paper with the designated leader. This sheet shows status only.</div>
    </div>
  );
}

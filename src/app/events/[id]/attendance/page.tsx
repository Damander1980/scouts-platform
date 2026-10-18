import Link from "next/link";
import { notFound } from "next/navigation";
import { requireLeader } from "@/lib/context";
import Shell from "@/components/Shell";
import { fmtDate } from "@/components/ui";
import AttendanceClient from "./AttendanceClient";

export default async function AttendancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireLeader();
  const { supabase, current } = ctx;
  const orgId = current.org.id;

  const { data: ev } = await supabase.from("events").select("id, title, start_at, overnight_nights, service_hours, miles, checkin_code").eq("id", id).eq("org_id", orgId).maybeSingle();
  if (!ev) notFound();

  const [{ data: members }, { data: rsvps }, { data: att }, { data: patrols }] = await Promise.all([
    supabase.from("memberships").select("person_id, persons(first_name, last_name, type)").eq("org_id", orgId).eq("status", "active"),
    supabase.from("rsvps").select("person_id, status").eq("event_id", id),
    supabase.from("attendance").select("person_id, present, method, confirmed").eq("event_id", id),
    supabase.from("patrol_members").select("person_id, patrols(name)").eq("org_id", orgId).is("end_date", null),
  ]);

  const rsvpOf = Object.fromEntries((rsvps ?? []).map((r) => [r.person_id, r.status]));
  const patrolOf = Object.fromEntries((patrols ?? []).map((p) => [p.person_id, (p.patrols as unknown as { name: string })?.name ?? ""]));
  const people = ((members ?? []) as unknown as { person_id: string; persons: { first_name: string; last_name: string; type: string } }[])
    .map((m) => ({ id: m.person_id, name: `${m.persons.first_name} ${m.persons.last_name}`, type: m.persons.type, rsvp: rsvpOf[m.person_id] ?? null, patrol: patrolOf[m.person_id] ?? "" }))
    .sort((a, b) => Number(b.rsvp === "going") - Number(a.rsvp === "going") || a.patrol.localeCompare(b.patrol) || a.name.localeCompare(b.name));

  return (
    <Shell ctx={ctx}>
      <Link href={`/events/${id}`} className="text-[13px] font-bold text-forest no-underline">← {ev.title}</Link>
      <div>
        <h1 className="font-display font-extrabold text-[26px] m-0">Attendance</h1>
        <p className="text-[14px] text-smoke m-0 mt-1">
          {fmtDate(ev.start_at)} · Present Scouts are credited {ev.overnight_nights} nights, {ev.service_hours} service hours, {ev.miles} miles automatically.
        </p>
      </div>
      <AttendanceClient orgId={orgId} eventId={id} people={people} checkinCode={ev.checkin_code}
        initial={Object.fromEntries((att ?? []).map((a) => [a.person_id, { present: a.present, method: a.method, confirmed: a.confirmed }]))} />
    </Shell>
  );
}

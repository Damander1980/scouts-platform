import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/context";
import Shell from "@/components/Shell";
import TripPlanClient, { type Plan } from "./TripPlanClient";

export default async function TripPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrg();
  const { supabase, current, isLeader } = ctx;
  const { data: ev } = await supabase.from("events").select("id, title, start_at, end_at, cost_cents, location, org_id").eq("id", id).eq("org_id", current.org.id).maybeSingle();
  if (!ev) notFound();

  const [{ data: plan }, { data: going }, { data: patrols }, { data: pm }, { data: adults }] = await Promise.all([
    supabase.from("trip_plans").select("*").eq("event_id", id).maybeSingle(),
    supabase.from("rsvps").select("person_id, driver_seats, persons(type)").eq("event_id", id).eq("status", "going"),
    supabase.from("patrols").select("id, name").eq("org_id", current.org.id).eq("active", true).order("name"),
    supabase.from("patrol_members").select("person_id, patrol_id").eq("org_id", current.org.id).is("end_date", null),
    supabase.from("memberships").select("person_id, persons(first_name, last_name, type)").eq("org_id", current.org.id).eq("status", "active"),
  ]);
  const goingRows = (going ?? []) as unknown as { person_id: string; driver_seats: number; persons: { type: string } }[];
  const patrolOf = Object.fromEntries((pm ?? []).map((p) => [p.person_id, p.patrol_id]));
  const patrolCounts = Object.fromEntries((patrols ?? []).map((p) => [p.id, goingRows.filter((g) => patrolOf[g.person_id] === p.id).length]));
  const people = ((adults ?? []) as unknown as { person_id: string; persons: { first_name: string; last_name: string; type: string } }[])
    .filter((a) => a.persons.type === "adult").map((a) => ({ id: a.person_id, name: `${a.persons.first_name} ${a.persons.last_name}` }));

  return (
    <Shell ctx={ctx}>
      <Link href={`/events/${id}`} className="text-[13px] font-bold text-forest no-underline">← {ev.title}</Link>
      <TripPlanClient
        eventId={id} orgId={current.org.id} canEdit={isLeader} title={ev.title} costCents={ev.cost_cents}
        plan={(plan as Plan | null) ?? { itinerary: [], costs: [], meals: [], packing: [], tasks: [], permits: [] }}
        youthGoing={goingRows.filter((g) => g.persons.type === "youth").length}
        adultsGoing={goingRows.filter((g) => g.persons.type === "adult").length}
        seats={goingRows.reduce((s, g) => s + (g.driver_seats || 0), 0)}
        patrols={(patrols ?? []).map((p) => ({ ...p, going: patrolCounts[p.id] ?? 0 }))}
        adults={people}
      />
    </Shell>
  );
}

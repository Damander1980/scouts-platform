import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Load the user's person record
  const { data: person } = await supabase
    .from("persons")
    .select("id, first_name, last_name, type")
    .eq("user_id", user.id)
    .single();

  if (!person) redirect("/setup");

  // Load their memberships → orgs
  const { data: memberships } = await supabase
    .from("memberships")
    .select("role, org_id, organizations(id, name, type, unit_number, city, join_code)")
    .eq("person_id", person.id)
    .eq("status", "active");

  if (!memberships || memberships.length === 0) redirect("/setup");

  // Use first org for now (multi-org switcher is future)
  const membership = memberships[0];
  const org = membership.organizations as unknown as {
    id: string; name: string; type: string; unit_number: string; city: string; join_code: string;
  };

  // Upcoming events (next 60 days)
  const now = new Date().toISOString();
  const future = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data: events } = await supabase
    .from("events")
    .select("id, title, start_at, end_at, cost_cents, location, cap")
    .eq("org_id", org.id)
    .gte("start_at", now)
    .lte("start_at", future)
    .order("start_at", { ascending: true })
    .limit(10);

  // My RSVPs for those events
  const eventIds = (events ?? []).map((e) => e.id);
  const { data: myRsvps } = eventIds.length > 0
    ? await supabase
        .from("rsvps")
        .select("event_id, status")
        .eq("person_id", person.id)
        .in("event_id", eventIds)
    : { data: [] };

  // Household balance
  const { data: household } = await supabase
    .from("household_members")
    .select("household_id, households(id, name)")
    .eq("person_id", person.id)
    .maybeSingle();

  let balanceCents = 0;
  if (household?.household_id) {
    const { data: ledger } = await supabase
      .from("ledger_entries")
      .select("amount_cents")
      .eq("household_id", household.household_id);
    balanceCents = (ledger ?? []).reduce((s, r) => s + r.amount_cents, 0);
  }

  // Action items: events with cost that user hasn't paid RSVPs for
  const rsvpMap = Object.fromEntries((myRsvps ?? []).map((r) => [r.event_id, r.status]));

  const actionItems = (events ?? [])
    .filter((e) => e.cost_cents > 0 && rsvpMap[e.id] === "going")
    .map((e) => ({
      id: e.id,
      title: `Pay for ${e.title}`,
      amount: e.cost_cents,
      due: e.start_at,
    }));

  return (
    <DashboardClient
      person={person}
      org={org}
      role={membership.role}
      events={(events ?? []).map((e) => ({
        ...e,
        rsvpStatus: rsvpMap[e.id] ?? null,
      }))}
      actionItems={actionItems}
      balanceCents={balanceCents}
    />
  );
}

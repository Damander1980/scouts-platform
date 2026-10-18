import { requireLeader } from "@/lib/context";
import PatrolsClient from "./PatrolsClient";

export default async function PatrolsPage() {
  const { supabase, current } = await requireLeader();
  const orgId = current.org.id;
  const [{ data: patrols }, { data: pm }, { data: members }, { data: positions }] = await Promise.all([
    supabase.from("patrols").select("id, name, kind, active").eq("org_id", orgId).order("name"),
    supabase.from("patrol_members").select("id, patrol_id, person_id, role, start_date").eq("org_id", orgId).is("end_date", null),
    supabase.from("memberships").select("person_id, role, persons(first_name, last_name, type)").eq("org_id", orgId).eq("status", "active"),
    supabase.from("leadership_positions").select("id, person_id, title, start_date, end_date").eq("org_id", orgId).order("start_date", { ascending: false }),
  ]);
  const people = ((members ?? []) as unknown as { person_id: string; role: string; persons: { first_name: string; last_name: string; type: string } }[])
    .map((m) => ({ id: m.person_id, name: `${m.persons.first_name} ${m.persons.last_name}`, type: m.persons.type }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <PatrolsClient orgId={orgId} unitType={current.org.type} canEdit
      patrols={patrols ?? []} memberships={pm ?? []} people={people} positions={positions ?? []} />
  );
}

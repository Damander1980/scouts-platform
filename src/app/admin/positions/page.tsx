import { requireStaff } from "@/lib/context";
import PositionsClient, { type Position, type CatalogPerm, type Person } from "./PositionsClient";

export default async function PositionsPage() {
  const { supabase, current, isAdmin } = await requireStaff();
  const orgId = current.org.id;

  const [{ data: positions }, { data: holders }, { data: catalog }, { data: members }] = await Promise.all([
    supabase.from("unit_positions").select("id, title, audience, permissions, sort").eq("org_id", orgId).order("sort").order("title"),
    supabase.from("position_holders").select("position_id, person_id").eq("org_id", orgId),
    supabase.from("permission_catalog").select("key, label, description, adult_only, needs_ypt").order("sort"),
    supabase.from("memberships").select("person_id, ypt_expires, persons(first_name, last_name, type)").eq("org_id", orgId).eq("status", "active"),
  ]);

  const people: Person[] = ((members ?? []) as unknown as { person_id: string; ypt_expires: string | null; persons: { first_name: string; last_name: string; type: string } }[])
    .map((m) => ({ id: m.person_id, name: `${m.persons.last_name}, ${m.persons.first_name}`, type: m.persons.type, yptOk: !!m.ypt_expires && m.ypt_expires >= new Date().toISOString().slice(0, 10) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <PositionsClient
      orgId={orgId}
      isAdmin={isAdmin}
      positions={(positions ?? []) as Position[]}
      holders={holders ?? []}
      catalog={(catalog ?? []) as CatalogPerm[]}
      people={people}
    />
  );
}

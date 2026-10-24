import { requirePerm } from "@/lib/context";
import GearClient from "./GearClient";

export default async function GearPage() {
  const { supabase, current } = await requirePerm("leader", "gear.manage", "docs.manage");
  const orgId = current.org.id;
  const [{ data: items }, { data: outs }, { data: members }, { data: docs }] = await Promise.all([
    supabase.from("equipment").select("id, name, category, tag, condition, notes").eq("org_id", orgId).order("category").order("name"),
    supabase.from("checkouts").select("id, equipment_id, person_id, out_at, due_at, returned_at").eq("org_id", orgId).is("returned_at", null),
    supabase.from("memberships").select("person_id, persons(first_name, last_name)").eq("org_id", orgId).eq("status", "active"),
    supabase.from("documents").select("id, title, url, category, visibility").eq("org_id", orgId).order("category").order("title"),
  ]);
  const people = ((members ?? []) as unknown as { person_id: string; persons: { first_name: string; last_name: string } }[])
    .filter((m) => m.persons)
    .map((m) => ({ id: m.person_id, name: `${m.persons.first_name} ${m.persons.last_name}` })).sort((a, b) => a.name.localeCompare(b.name));
  return <GearClient orgId={orgId} items={items ?? []} outs={outs ?? []} people={people} docs={docs ?? []} />;
}

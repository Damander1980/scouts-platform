import type { SupabaseClient } from "@supabase/supabase-js";

export type FamilyMember = { id: string; first_name: string; last_name: string; type: string; birthdate: string | null; in_org: boolean; role: string | null };

// The signed-in person's household, flagged with who belongs to the current troop.
export async function loadFamily(supabase: SupabaseClient, orgId: string): Promise<FamilyMember[]> {
  const { data: fam } = await supabase.rpc("my_family");
  const people = (fam ?? []) as Omit<FamilyMember, "in_org" | "role">[];
  if (!people.length) return [];
  const { data: ms } = await supabase.from("memberships").select("person_id, role")
    .eq("org_id", orgId).eq("status", "active").in("person_id", people.map((p) => p.id));
  const roleBy = Object.fromEntries((ms ?? []).map((m) => [m.person_id, m.role]));
  return people.map((p) => ({ ...p, in_org: p.id in roleBy, role: roleBy[p.id] ?? null }));
}

export async function householdBalance(supabase: SupabaseClient, householdId: string | null, orgId: string) {
  if (!householdId) return 0;
  const { data } = await supabase.from("ledger_entries").select("amount_cents").eq("household_id", householdId).eq("org_id", orgId);
  return (data ?? []).reduce((s, r) => s + r.amount_cents, 0);
}

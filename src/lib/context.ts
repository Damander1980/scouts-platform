import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const LEADER_ROLES = [
  "scoutmaster", "assistant_scoutmaster", "committee_chair", "committee_member", "treasurer",
  "advancement_chair", "chartered_org_rep", "den_leader", "cubmaster", "crew_advisor", "skipper",
];

export const ROLE_LABELS: Record<string, string> = {
  scoutmaster: "Scoutmaster", assistant_scoutmaster: "Assistant Scoutmaster",
  committee_chair: "Committee Chair", committee_member: "Committee Member", treasurer: "Treasurer",
  advancement_chair: "Advancement Chair", chartered_org_rep: "Chartered Org Rep",
  parent_guardian: "Parent / Guardian", scout: "Scout", den_leader: "Den Leader",
  cubmaster: "Cubmaster", crew_advisor: "Crew Advisor", skipper: "Skipper",
  merit_badge_counselor: "Merit Badge Counselor",
};

export type Org = {
  id: string; name: string; type: string; unit_number: string | null; city: string | null;
  state: string | null; slug: string; join_code: string; settings: Record<string, unknown>;
};
export type Membership = { id: string; role: string; status: string; is_admin: boolean; is_designated_leader: boolean; org: Org };

export function unitWord(type: string) {
  return type === "cubs" ? "Pack" : type === "venturing" ? "Crew" : type === "sea" ? "Ship" : "Troop";
}

export const ORG_COOKIE = "sp_org";

export async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: person } = await supabase
    .from("persons").select("id, first_name, last_name, type").eq("user_id", user.id).maybeSingle();

  let memberships: Membership[] = [];
  let householdId: string | null = null;
  if (person) {
    const [{ data: ms }, { data: hm }] = await Promise.all([
      supabase.from("memberships")
        .select("id, role, status, is_admin, is_designated_leader, organizations(id, name, type, unit_number, city, state, slug, join_code, settings)")
        .eq("person_id", person.id).eq("status", "active"),
      supabase.from("household_members").select("household_id").eq("person_id", person.id).limit(1),
    ]);
    memberships = (ms ?? []).map((m) => ({ ...m, org: m.organizations as unknown as Org })) as unknown as Membership[];
    householdId = hm?.[0]?.household_id ?? null;
  }

  const cookieStore = await cookies();
  const wanted = cookieStore.get(ORG_COOKIE)?.value;
  const current = memberships.find((m) => m.org.id === wanted) ?? memberships[0] ?? null;
  const isLeader = !!current && (LEADER_ROLES.includes(current.role) || current.is_admin);

  return { supabase, user, person, memberships, current, householdId, isLeader, isAdmin: !!current?.is_admin };
}

// For pages that require a troop membership.
export async function requireOrg() {
  const ctx = await getContext();
  if (!ctx.person || !ctx.householdId) redirect("/welcome");
  if (!ctx.current) redirect("/welcome?step=troop");
  return ctx as typeof ctx & { person: NonNullable<typeof ctx.person>; current: Membership };
}

export async function requireLeader() {
  const ctx = await requireOrg();
  if (!ctx.isLeader) redirect("/dashboard");
  return ctx;
}

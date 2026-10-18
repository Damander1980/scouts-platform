import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminLayoutClient from "./AdminLayoutClient";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: person } = await supabase
    .from("persons")
    .select("id, first_name, last_name")
    .eq("user_id", user.id)
    .single();

  if (!person) redirect("/setup");

  const { data: membership } = await supabase
    .from("memberships")
    .select("role, org_id, organizations(id, name, type, unit_number, city, join_code)")
    .eq("person_id", person.id)
    .eq("status", "active")
    .single();

  if (!membership) redirect("/setup");

  const leaderRoles = [
    "scoutmaster","assistant_scoutmaster","committee_chair","committee_member",
    "treasurer","advancement_chair","chartered_org_rep","den_leader","cubmaster",
    "crew_advisor","skipper",
  ];
  if (!leaderRoles.includes(membership.role)) redirect("/dashboard");

  const org = membership.organizations as unknown as {
    id: string; name: string; type: string; unit_number: string; city: string; join_code: string;
  };

  return (
    <AdminLayoutClient person={person} org={org} role={membership.role}>
      {children}
    </AdminLayoutClient>
  );
}

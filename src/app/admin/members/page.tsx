import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MembersClient from "./MembersClient";

export default async function MembersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: person } = await supabase.from("persons").select("id").eq("user_id", user.id).single();
  if (!person) redirect("/setup");

  const { data: membership } = await supabase
    .from("memberships").select("org_id, role").eq("person_id", person.id).eq("status", "active").single();
  if (!membership) redirect("/setup");

  const { data: members } = await supabase
    .from("memberships")
    .select(`
      id, role, status, joined_at, ypt_expires,
      persons(id, first_name, last_name, type, birthdate, user_id)
    `)
    .eq("org_id", membership.org_id)
    .order("joined_at", { ascending: false });

  return <MembersClient members={members ?? []} orgId={membership.org_id} myRole={membership.role} />;
}

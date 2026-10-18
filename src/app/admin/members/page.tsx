import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MembersClient, { type Member } from "./MembersClient";

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

  const [{ data: badges }, { data: counselorAssignments }] = await Promise.all([
    supabase.from("advancement_items").select("id, name, eagle_required").eq("kind", "badge").order("name"),
    supabase.from("merit_badge_counselors").select("person_id, item_id").eq("org_id", membership.org_id),
  ]);

  return (
    <MembersClient
      members={(members ?? []) as unknown as Member[]}
      orgId={membership.org_id}
      myRole={membership.role}
      badges={badges ?? []}
      counselorAssignments={counselorAssignments ?? []}
    />
  );
}

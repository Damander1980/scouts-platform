import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdvancementClient, { type Progress, type Tracked } from "@/components/AdvancementClient";
import { loadCatalog } from "@/lib/advancement";

const LEADER_ROLES = [
  "scoutmaster","assistant_scoutmaster","committee_chair","committee_member","treasurer",
  "advancement_chair","chartered_org_rep","den_leader","cubmaster","crew_advisor","skipper",
];

export default async function ScoutAdvancementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: viewer } = await supabase.from("persons").select("id").eq("user_id", user.id).single();
  if (!viewer) redirect("/setup");

  const { data: scout } = await supabase.from("persons").select("id, first_name, last_name").eq("id", id).single();
  if (!scout) notFound();

  const { data: scoutMembership } = await supabase
    .from("memberships").select("org_id").eq("person_id", id).eq("status", "active").single();
  if (!scoutMembership) notFound();
  const orgId = scoutMembership.org_id;

  const { data: viewerMembership } = await supabase
    .from("memberships").select("role").eq("person_id", viewer.id).eq("org_id", orgId).eq("status", "active").maybeSingle();
  const isLeader = !!viewerMembership && LEADER_ROLES.includes(viewerMembership.role);

  let allowed = isLeader || viewer.id === id;
  if (!allowed) {
    const { data: myHouseholds } = await supabase
      .from("household_members").select("household_id").eq("person_id", viewer.id).eq("is_guardian", true);
    const ids = (myHouseholds ?? []).map((h) => h.household_id);
    if (ids.length) {
      const { count } = await supabase.from("household_members")
        .select("*", { count: "exact", head: true }).eq("person_id", id).in("household_id", ids);
      allowed = (count ?? 0) > 0;
    }
  }
  if (!allowed) redirect("/dashboard");

  const [items, { data: tracked }, { data: progressRows }] = await Promise.all([
    loadCatalog(supabase),
    supabase.from("scout_advancement").select("item_id, status, assigned_by").eq("person_id", id),
    supabase.from("requirement_progress").select("requirement_id, completed_at, approved_by").eq("person_id", id),
  ]);

  const progress: Progress = Object.fromEntries(
    (progressRows ?? []).map((p) => [p.requirement_id, { completed_at: p.completed_at, approved_by: p.approved_by }]),
  );

  return (
    <AdvancementClient
      scout={scout}
      orgId={orgId}
      items={items}
      tracked={(tracked ?? []) as Tracked[]}
      progress={progress}
      isLeader={isLeader}
      viewerPersonId={viewer.id}
    />
  );
}

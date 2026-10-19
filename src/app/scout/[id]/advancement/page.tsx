import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdvancementClient, { type Progress, type Tracked } from "@/components/AdvancementClient";
import { loadCatalog } from "@/lib/advancement";

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
    .from("memberships").select("org_id, organizations(type)").eq("person_id", id).eq("status", "active").single();
  if (!scoutMembership) notFound();
  const orgId = scoutMembership.org_id;
  const orgType = (scoutMembership.organizations as unknown as { type: string } | null)?.type;

  const [{ data: viewerMembership }, { data: leaderPerm }] = await Promise.all([
    supabase.from("memberships").select("role").eq("person_id", viewer.id).eq("org_id", orgId).eq("status", "active").maybeSingle(),
    supabase.rpc("has_perm", { org: orgId, perm: "leader" }),
  ]);
  const isLeader = !!leaderPerm;

  const { data: counselorRows } = await supabase
    .from("merit_badge_counselors").select("item_id").eq("org_id", orgId).eq("person_id", viewer.id);
  const counselorBadgeIds = (counselorRows ?? []).map((r) => r.item_id as string);

  let allowed = isLeader || viewer.id === id || (!!viewerMembership && counselorBadgeIds.length > 0);
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

  const [items, { data: tracked }, { data: progressRows }, { data: who }, { data: positions }, { data: att }, { data: counselors }] = await Promise.all([
    loadCatalog(supabase),
    supabase.from("scout_advancement").select("id, item_id, status, assigned_by, counselor_id, completed_at").eq("person_id", id),
    supabase.from("requirement_progress").select("requirement_id, completed_at, approved_by, approved_at").eq("person_id", id),
    supabase.rpc("person_private", { p_org: orgId, p_ids: [id] }).maybeSingle<{ birthdate: string | null }>(),
    supabase.from("leadership_positions").select("title, start_date, end_date, counts_for_rank").eq("org_id", orgId).eq("person_id", id),
    supabase.from("attendance").select("present, events(start_at, kind, overnight_nights, service_hours, miles, canceled)").eq("person_id", id).eq("org_id", orgId).eq("present", true),
    supabase.from("merit_badge_counselors").select("person_id, item_id, persons(first_name, last_name)").eq("org_id", orgId),
  ]);

  const progress: Progress = Object.fromEntries(
    (progressRows ?? []).map((p) => [p.requirement_id, { completed_at: p.completed_at, approved_by: p.approved_by }]),
  );

  // Date each rank was earned: recorded completion, or the last sign-off once every requirement is signed.
  const approvedAt = Object.fromEntries((progressRows ?? []).map((p) => [p.requirement_id, p.approved_at as string | null]));
  const rankEarned: Record<string, string | null> = {};
  for (const r of items.filter((i) => i.kind === "rank" && i.program === "scouts_bsa")) {
    const t = (tracked ?? []).find((x) => x.item_id === r.id && x.status === "completed");
    const dates = r.requirements.map((q) => approvedAt[q.id]);
    rankEarned[r.code] = t?.completed_at ?? (dates.length && dates.every(Boolean) ? (dates as string[]).sort().at(-1)! : null);
  }

  type Ev = { start_at: string; kind: string; overnight_nights: number; service_hours: number; miles: number; canceled: boolean };
  const attended = (att ?? []).map((a) => a.events as unknown as Ev).filter((e) => e && !e.canceled);
  const credits = {
    nights: attended.filter((e) => e.kind !== "service").reduce((s, e) => s + Number(e.overnight_nights), 0),
    service: attended.reduce((s, e) => s + Number(e.service_hours), 0),
    miles: attended.filter((e) => e.kind !== "service").reduce((s, e) => s + Number(e.miles), 0),
    events: attended.length,
  };
  const serviceEvents = attended.filter((e) => Number(e.service_hours) > 0).map((e) => ({ at: e.start_at, hours: Number(e.service_hours) }));

  const counselorList = Object.values(((counselors ?? []) as unknown as { person_id: string; item_id: string; persons: { first_name: string; last_name: string } }[])
    .reduce<Record<string, { id: string; name: string; items: string[] }>>((acc, c) => {
      acc[c.person_id] ??= { id: c.person_id, name: `${c.persons.first_name} ${c.persons.last_name}`, items: [] };
      acc[c.person_id].items.push(c.item_id);
      return acc;
    }, {}));

  return (
    <AdvancementClient
      scout={scout}
      orgId={orgId}
      items={items}
      tracked={(tracked ?? []) as Tracked[]}
      progress={progress}
      isLeader={isLeader}
      viewerPersonId={viewer.id}
      program={orgType === "cubs" ? "cubs" : "scouts_bsa"}
      counselorBadgeIds={counselorBadgeIds}
      extras={{ birthdate: who?.birthdate ?? null, rankEarned, positions: positions ?? [], credits, serviceEvents, counselors: counselorList }}
    />
  );
}

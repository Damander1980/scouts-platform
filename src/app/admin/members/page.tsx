import { requirePerm } from "@/lib/context";
import MembersClient, { type Member, type JoinRequest } from "./MembersClient";

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab, q } = await searchParams;
  const { supabase, current, isAdmin, person } = await requirePerm("leader", "members.manage", "members.private");
  const orgId = current.org.id;

  const [{ data: hhList }, { data: hhOf }, { data: members }, { data: badges }, { data: counselorAssignments }, { data: reqs }, { data: patrols }] = await Promise.all([
    supabase.rpc("unit_households", { p_org: orgId }),
    supabase.rpc("person_households", { p_org: orgId }),
    supabase.from("memberships")
      .select("id, role, status, joined_at, ypt_expires, is_admin, is_designated_leader, position, registration_expires, persons(id, first_name, last_name, type, user_id)")
      .eq("org_id", orgId).order("joined_at", { ascending: false }),
    supabase.from("advancement_items").select("id, name, eagle_required").eq("kind", "badge").order("name"),
    supabase.from("merit_badge_counselors").select("person_id, item_id").eq("org_id", orgId),
    supabase.from("join_requests").select("id, person_ids, created_at, requested_by, status").eq("org_id", orgId).eq("status", "pending").order("created_at"),
    supabase.from("patrol_members").select("person_id, patrols(name)").eq("org_id", orgId).is("end_date", null),
  ]);

  // Birthdates only for people allowed to see private details (adults with current YPT).
  const [{ data: priv }, { data: reqNames }] = await Promise.all([
    (members ?? []).length
      ? supabase.rpc("person_private", { p_org: orgId, p_ids: (members ?? []).map((m) => (m.persons as unknown as { id: string } | null)?.id).filter(Boolean) })
      : Promise.resolve({ data: [] }),
    (reqs ?? []).length ? supabase.rpc("join_request_people", { p_org: orgId }) : Promise.resolve({ data: [] }),
  ]);
  const born = Object.fromEntries(((priv ?? []) as { id: string; birthdate: string | null }[]).map((r) => [r.id, r.birthdate]));
  const withBirth = (members ?? []).map((m) => {
    const p = m.persons as unknown as { id: string } | null;
    return p ? { ...m, persons: { ...p, birthdate: born[p.id] ?? null } } : m;
  });

  const nameOf = Object.fromEntries(((reqNames ?? []) as { person_id: string; first_name: string; last_name: string; type: string; birthdate: string | null }[])
    .map((p) => [p.person_id, { id: p.person_id, ...p }]));
  const joinRequests: JoinRequest[] = (reqs ?? []).map((r) => ({
    id: r.id, created_at: r.created_at,
    requester: nameOf[r.requested_by] ? `${nameOf[r.requested_by].first_name} ${nameOf[r.requested_by].last_name}` : "A family",
    people: (r.person_ids as string[]).map((id) => nameOf[id]).filter(Boolean).map((p) => ({ id: p.id, name: `${p.first_name} ${p.last_name}`, type: p.type, birthdate: p.birthdate })),
  }));

  return (
    <MembersClient key={q ?? ""}
      members={withBirth as unknown as Member[]}
      orgId={orgId}
      joinCode={current.org.join_code}
      slug={current.org.slug}
      isAdmin={isAdmin}
      myPersonId={person.id}
      badges={badges ?? []}
      counselorAssignments={counselorAssignments ?? []}
      joinRequests={joinRequests}
      patrolOf={Object.fromEntries((patrols ?? []).map((p) => [p.person_id, (p.patrols as unknown as { name: string })?.name ?? ""]))}
      initialTab={tab === "requests" ? "requests" : "members"}
      initialSearch={q ?? ""}
      households={(hhList ?? []) as never}
      personHouseholds={(hhOf ?? []) as never}
    />
  );
}

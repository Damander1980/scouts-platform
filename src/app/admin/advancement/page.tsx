import { requireLeader } from "@/lib/context";
import AdvancementAdmin from "./AdvancementAdmin";

export default async function AdminAdvancementPage() {
  const { supabase, current } = await requireLeader();
  const orgId = current.org.id;
  const [{ data: queue }, { data: summary }, { data: awards }, { data: requests }] = await Promise.all([
    supabase.rpc("signoff_queue", { p_org: orgId }),
    supabase.rpc("unit_advancement", { p_org: orgId }),
    supabase.rpc("awards_to_buy", { p_org: orgId }),
    supabase.from("scout_advancement").select("id, person_id, created:started_at, persons(first_name, last_name), advancement_items(name)").eq("org_id", orgId).eq("status", "requested"),
  ]);
  return (
    <AdvancementAdmin
      orgId={orgId}
      unitType={current.org.type}
      queue={(queue ?? []) as never}
      summary={(summary ?? []) as never}
      awards={(awards ?? []) as never}
      requests={((requests ?? []) as unknown as { id: string; person_id: string; created: string; persons: { first_name: string; last_name: string }; advancement_items: { name: string } }[])
        .map((r) => ({ id: r.id, person_id: r.person_id, scout: `${r.persons.first_name} ${r.persons.last_name}`, badge: r.advancement_items.name, at: r.created }))}
    />
  );
}

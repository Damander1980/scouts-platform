import { requireOrg } from "@/lib/context";
import Shell from "@/components/Shell";
import { PageTitle } from "@/components/ui";
import ComposeClient from "./ComposeClient";

export default async function NewMessagePage({ searchParams }: { searchParams: Promise<{ audience?: string; ref?: string }> }) {
  const { audience, ref } = await searchParams;
  const ctx = await requireOrg();
  const { supabase, current, person, isLeader } = ctx;
  const orgId = current.org.id;

  const [{ data: patrols }, { data: myPatrolRoles }, { data: events }, { data: members }] = await Promise.all([
    supabase.from("patrols").select("id, name").eq("org_id", orgId).eq("active", true).order("name"),
    supabase.from("patrol_members").select("patrol_id, role").eq("person_id", person.id).is("end_date", null),
    isLeader ? supabase.from("events").select("id, title, start_at").eq("org_id", orgId).gte("start_at", new Date(Date.now() - 7 * 86400000).toISOString()).order("start_at").limit(30) : Promise.resolve({ data: [] }),
    isLeader ? supabase.from("memberships").select("person_id, persons(first_name, last_name, type)").eq("org_id", orgId).eq("status", "active") : Promise.resolve({ data: [] }),
  ]);

  const leadsPatrols = (myPatrolRoles ?? []).filter((r) => ["patrol_leader", "assistant_patrol_leader"].includes(r.role)).map((r) => r.patrol_id);
  const allowedPatrols = (patrols ?? []).filter((p) => isLeader || leadsPatrols.includes(p.id));

  return (
    <Shell ctx={ctx}>
      <PageTitle title="New message" sub="Saved permanently. Any message that includes a Scout is copied to their parents and the designated leaders." />
      <ComposeClient
        orgId={orgId}
        isLeader={isLeader}
        patrols={allowedPatrols}
        events={(events ?? []) as { id: string; title: string; start_at: string }[]}
        members={((members ?? []) as unknown as { person_id: string; persons: { first_name: string; last_name: string; type: string } }[])
          .map((m) => ({ id: m.person_id, name: `${m.persons.first_name} ${m.persons.last_name}`, type: m.persons.type }))
          .sort((a, b) => a.name.localeCompare(b.name))}
        initialAudience={audience ?? (isLeader ? "troop" : "leaders")}
        initialRef={ref ?? ""}
      />
    </Shell>
  );
}

import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/context";
import Shell from "@/components/Shell";
import { PageTitle } from "@/components/ui";
import PlcClient, { type Action, type Meeting } from "./PlcClient";

export default async function PlcPage() {
  const ctx = await requireOrg();
  const { supabase, current, person } = ctx;
  const orgId = current.org.id;
  const { data: member, error } = await supabase.rpc("is_plc_member", { org: orgId });
  if (error) {
    return <Shell ctx={ctx}><PageTitle title="Patrol Leaders' Council" /><div className="card text-smoke">The PLC space turns on once the latest database update is applied.</div></Shell>;
  }
  if (!member) redirect("/dashboard");

  const [{ data: meetings }, { data: actions }, { data: roster }] = await Promise.all([
    supabase.from("plc_meetings").select("id, meeting_date, agenda, notes").eq("org_id", orgId).order("meeting_date", { ascending: false }).limit(20),
    supabase.from("plc_actions").select("id, text, owner_id, due_date, done_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(100),
    supabase.from("memberships").select("person_id, persons(first_name, last_name)").eq("org_id", orgId).eq("status", "active"),
  ]);
  const people = ((roster ?? []) as unknown as { person_id: string; persons: { first_name: string; last_name: string } }[])
    .filter((r) => r.persons)
    .map((r) => ({ id: r.person_id, name: `${r.persons.first_name} ${r.persons.last_name}` })).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Shell ctx={ctx}>
      <PageTitle title="Patrol Leaders' Council" sub="Plan the program together. Unit leaders can see everything here." />
      <PlcClient orgId={orgId} myId={person.id} meetings={(meetings ?? []) as Meeting[]} actions={(actions ?? []) as Action[]} people={people} />
    </Shell>
  );
}

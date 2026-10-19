import { requireOrg } from "@/lib/context";
import Shell from "@/components/Shell";
import { PageTitle } from "@/components/ui";
import { loadFamily } from "@/lib/family";
import VolunteerClient from "./VolunteerClient";

export default async function VolunteerPage() {
  const ctx = await requireOrg();
  const { supabase, current, person } = ctx;
  const orgId = current.org.id;
  const family = (await loadFamily(supabase, orgId)).filter((f) => f.in_org);
  const [{ data: shifts }, { data: signups }, { data: polls }, { data: votes }, { data: members }] = await Promise.all([
    supabase.from("shifts").select("id, title, location, starts_at, ends_at, slots").eq("org_id", orgId).gte("ends_at", new Date().toISOString()).order("starts_at"),
    supabase.from("shift_signups").select("shift_id, person_id").eq("org_id", orgId),
    supabase.from("polls").select("id, question, options, audience, closes_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(20),
    supabase.from("poll_votes").select("poll_id, person_id, choice").eq("org_id", orgId),
    supabase.from("memberships").select("person_id, persons(first_name, last_name)").eq("org_id", orgId).eq("status", "active"),
  ]);
  const nameOf = Object.fromEntries(((members ?? []) as unknown as { person_id: string; persons: { first_name: string; last_name: string } }[])
    .map((m) => [m.person_id, `${m.persons.first_name} ${m.persons.last_name}`]));
  void person;
  return (
    <Shell ctx={ctx}>
      <PageTitle title="Help & vote" sub="Sign up for volunteer shifts and have your say." />
      <VolunteerClient
        family={family.map((f) => ({ id: f.id, name: f.first_name, type: f.type }))}
        shifts={shifts ?? []}
        signups={(signups ?? []).map((s) => ({ ...s, name: nameOf[s.person_id] ?? "Member" }))}
        polls={(polls ?? []) as never}
        votes={votes ?? []}
        orgId={orgId}
      />
    </Shell>
  );
}

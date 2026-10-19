import { requirePerm } from "@/lib/context";
import VolunteerAdmin from "./VolunteerAdmin";

export default async function VolunteerPage() {
  const { supabase, current } = await requirePerm("leader", "volunteer.manage");
  const orgId = current.org.id;
  const [{ data: shifts }, { data: signups }, { data: polls }, { data: votes }, { data: members }] = await Promise.all([
    supabase.from("shifts").select("id, title, location, starts_at, ends_at, slots").eq("org_id", orgId).gte("ends_at", new Date(Date.now() - 86400000).toISOString()).order("starts_at"),
    supabase.from("shift_signups").select("shift_id, person_id").eq("org_id", orgId),
    supabase.from("polls").select("id, question, options, audience, closes_at, created_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(30),
    supabase.from("poll_votes").select("poll_id, choice").eq("org_id", orgId),
    supabase.from("memberships").select("person_id, persons(first_name, last_name)").eq("org_id", orgId).eq("status", "active"),
  ]);
  const nameOf = Object.fromEntries(((members ?? []) as unknown as { person_id: string; persons: { first_name: string; last_name: string } }[]).map((m) => [m.person_id, `${m.persons.first_name} ${m.persons.last_name}`]));
  return <VolunteerAdmin orgId={orgId} shifts={shifts ?? []} signups={(signups ?? []).map((s) => ({ ...s, name: nameOf[s.person_id] ?? "Member" }))} polls={(polls ?? []) as never} votes={votes ?? []} />;
}

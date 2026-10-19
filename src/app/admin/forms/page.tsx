import { requirePerm } from "@/lib/context";
import FormsClient from "./FormsClient";

export default async function AdminFormsPage() {
  const { supabase, current } = await requirePerm("leader", "medical.view", "medical.record");
  const orgId = current.org.id;
  const [{ data: members }, { data: forms }, { data: certs }, { data: scoutCerts }, { data: designated }] = await Promise.all([
    supabase.from("memberships").select("person_id, role, ypt_expires, swim_class, persons(first_name, last_name, type)").eq("org_id", orgId).eq("status", "active"),
    supabase.from("forms").select("person_id, type, exam_date, expires_at").eq("org_id", orgId),
    supabase.from("certifications").select("id, code, name").or(`org_id.is.null,org_id.eq.${orgId}`).order("name"),
    supabase.from("scout_certifications").select("id, person_id, cert_id, status, earned_at, note").eq("org_id", orgId),
    supabase.rpc("is_designated", { org: orgId }),
  ]);
  const people = ((members ?? []) as unknown as { person_id: string; role: string; ypt_expires: string | null; swim_class: string | null; persons: { first_name: string; last_name: string; type: string } }[])
    .map((m) => ({ id: m.person_id, name: `${m.persons.last_name}, ${m.persons.first_name}`, type: m.persons.type, role: m.role, ypt: m.ypt_expires, swim: m.swim_class }))
    .sort((a, b) => a.type.localeCompare(b.type) * -1 || a.name.localeCompare(b.name));
  return <FormsClient orgId={orgId} canMark={!!designated} people={people} forms={forms ?? []} certs={certs ?? []} scoutCerts={scoutCerts ?? []} />;
}

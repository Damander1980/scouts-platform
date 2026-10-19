import { requireOrg } from "@/lib/context";
import Shell from "@/components/Shell";
import { PageTitle } from "@/components/ui";
import { loadFamily } from "@/lib/family";
import PrivacyClient from "./PrivacyClient";

export default async function PrivacyPage() {
  const ctx = await requireOrg();
  const { supabase, current, person } = ctx;
  const family = await loadFamily(supabase, current.org.id);
  const { data: reqs } = await supabase.from("deletion_requests").select("id, person_id, status, execute_after, created_at").eq("requested_by", person.id).order("created_at", { ascending: false });
  return (
    <Shell ctx={ctx}>
      <PageTitle title="Privacy & data" sub="You control your family's data." />
      <PrivacyClient family={family.map((f) => ({ id: f.id, name: `${f.first_name} ${f.last_name}`, type: f.type }))} requests={reqs ?? []} />
    </Shell>
  );
}

import { requireLeader } from "@/lib/context";
import ImportClient from "./ImportClient";

export default async function ImportPage() {
  const { supabase, current, isAdmin } = await requireLeader();
  const { data: batches } = await supabase.from("import_batches").select("id, kind, file_name, row_count, created_at, undone_at")
    .eq("org_id", current.org.id).order("created_at", { ascending: false }).limit(20);
  return <ImportClient orgId={current.org.id} isAdmin={isAdmin} batches={batches ?? []} />;
}

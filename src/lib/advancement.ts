import type { SupabaseClient } from "@supabase/supabase-js";
import type { Item } from "@/components/AdvancementClient";

type ReqRow = { id: string; item_id: string; number: string; text: string; sort: number };

// PostgREST caps responses at 1000 rows, and the catalog is larger than that.
async function loadAllRequirements(supabase: SupabaseClient): Promise<ReqRow[]> {
  const PAGE = 1000;
  const rows: ReqRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("advancement_requirements")
      .select("id, item_id, number, text, sort")
      .order("item_id").order("sort").order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

export async function loadCatalog(supabase: SupabaseClient): Promise<Item[]> {
  const [{ data: items, error: ie }, reqs] = await Promise.all([
    supabase.from("advancement_items").select("id, kind, code, name, eagle_required, eagle_group, sort, program, rank_code, required, electives_needed, grade, source_slug").order("sort"),
    loadAllRequirements(supabase),
  ]);
  if (ie) throw ie;
  const byItem: Record<string, Item["requirements"]> = {};
  for (const r of reqs) (byItem[r.item_id] ??= []).push({ id: r.id, number: r.number, text: r.text, sort: r.sort });
  return (items ?? []).map((i) => ({ ...i, requirements: byItem[i.id] ?? [] })) as Item[];
}

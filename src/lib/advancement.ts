import type { SupabaseClient } from "@supabase/supabase-js";
import type { Item } from "@/components/AdvancementClient";

export async function loadCatalog(supabase: SupabaseClient): Promise<Item[]> {
  const [{ data: items, error: ie }, { data: reqs, error: re }] = await Promise.all([
    supabase.from("advancement_items").select("id, kind, code, name, eagle_required, eagle_group, sort").order("sort"),
    supabase.from("advancement_requirements").select("id, item_id, number, text, sort").order("sort").limit(5000),
  ]);
  if (ie) throw ie;
  if (re) throw re;
  const byItem: Record<string, Item["requirements"]> = {};
  for (const r of reqs ?? []) (byItem[r.item_id] ??= []).push({ id: r.id, number: r.number, text: r.text, sort: r.sort });
  return (items ?? []).map((i) => ({ ...i, requirements: byItem[i.id] ?? [] })) as Item[];
}

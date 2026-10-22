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

const RANK_ORDER = ["scout", "tenderfoot", "second_class", "first_class", "star", "life", "eagle"];

/** A Scout's next rank and how many of its requirements are signed off (light query for home screens). */
export async function nextRankSummary(supabase: SupabaseClient, personId: string) {
  const { data: ranks } = await supabase.from("advancement_items").select("id, code, name").eq("kind", "rank").eq("program", "scouts_bsa");
  if (!ranks?.length) return null;
  const ordered = [...ranks].sort((a, b) => RANK_ORDER.indexOf(a.code) - RANK_ORDER.indexOf(b.code));
  const [{ data: earned }, { data: reqs }, { data: done }] = await Promise.all([
    supabase.from("scout_advancement").select("item_id").eq("person_id", personId).eq("status", "completed").in("item_id", ordered.map((r) => r.id)),
    supabase.from("advancement_requirements").select("id, item_id").in("item_id", ordered.map((r) => r.id)),
    supabase.from("requirement_progress").select("requirement_id").eq("person_id", personId).not("approved_by", "is", null),
  ]);
  const earnedIds = new Set((earned ?? []).map((e) => e.item_id));
  const doneIds = new Set((done ?? []).map((d) => d.requirement_id));
  const reqsOf = (id: string) => (reqs ?? []).filter((r) => r.item_id === id);
  const allDone = (id: string) => { const rs = reqsOf(id); return rs.length > 0 && rs.every((r) => doneIds.has(r.id)); };
  const next = ordered.find((r) => !earnedIds.has(r.id) && !allDone(r.id));
  if (!next) return { name: "Eagle Scout", done: 1, total: 1, complete: true };
  const rs = reqsOf(next.id);
  return { name: next.name, done: rs.filter((r) => doneIds.has(r.id)).length, total: rs.length, complete: false };
}

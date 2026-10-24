import Link from "next/link";
import { requireLeader } from "@/lib/context";
import { loadCatalog } from "@/lib/advancement";
import { TFC_RANKS, trailToFirstClass } from "@/lib/tfc";
import { starterModules } from "@/lib/skillTopics";
import ModuleLibrary, { type Module, type ReqGroup, type Session, type Starter } from "../tfc/ModuleLibrary";

// Skill modules for every rank and merit badge: what a meeting teaches, set up once, scheduled on dates,
// and shown to each Scout with their own progress. The Trail to First Class page links here.
const RANK_ORDER = ["scout", "tenderfoot", "second_class", "first_class", "star", "life", "eagle"];
type Row = { person_id: string; requirement_id: string; approved_by: string | null };

// "2. Do the following:" is a heading when 2a, 2b... exist, not a task of its own.
function tasks(reqs: { id: string; number: string; text: string; sort: number }[]) {
  const nums = reqs.map((r) => r.number.toLowerCase());
  return [...reqs].sort((a, b) => a.sort - b.sort)
    .filter((r) => !nums.some((n) => n !== r.number.toLowerCase() && n.startsWith(r.number.toLowerCase()) && /^[a-z]/.test(n.slice(r.number.length))));
}
const short = (t: string) => (t.length > 160 ? `${t.slice(0, 157).trimEnd()}…` : t);

export default async function SkillModulesPage() {
  const { supabase, current } = await requireLeader();
  const orgId = current.org.id;
  const [items, { data: ms }, { data: mods }, { data: sess }] = await Promise.all([
    loadCatalog(supabase),
    supabase.from("memberships").select("person_id, persons(type)").eq("org_id", orgId).eq("status", "active"),
    supabase.from("skill_modules").select("id, title, requirement_ids, notes, links, sort").eq("org_id", orgId).order("sort").order("created_at"),
    supabase.from("skill_sessions").select("id, module_id, on_date").eq("org_id", orgId).order("on_date"),
  ]);
  const scoutIds = ((ms ?? []) as unknown as { person_id: string; persons: { type: string } | null }[]).filter((m) => m.persons?.type === "youth").map((m) => m.person_id);
  const ranks = items.filter((i) => i.kind === "rank" && i.program === "scouts_bsa").sort((a, b) => RANK_ORDER.indexOf(a.code) - RANK_ORDER.indexOf(b.code));
  const badges = items.filter((i) => i.kind === "badge").sort((a, b) => Number(!!b.eagle_required) - Number(!!a.eagle_required) || a.name.localeCompare(b.name));

  // Who still needs what: a rank requirement counts for every Scout who hasn't earned that rank; a merit badge
  // requirement only for Scouts working on that badge.
  const [{ data: tracked }, progress] = await Promise.all([
    scoutIds.length ? supabase.from("scout_advancement").select("person_id, item_id, status").in("person_id", scoutIds) : Promise.resolve({ data: [] }),
    (async () => {
      const out: Row[] = [];
      if (!scoutIds.length) return out;
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase.from("requirement_progress").select("person_id, requirement_id, approved_by")
          .in("person_id", scoutIds).not("approved_by", "is", null).order("person_id").order("requirement_id").range(from, from + 999);
        out.push(...((data ?? []) as Row[]));
        if (!data || data.length < 1000) return out;
      }
    })(),
  ]);
  const signed = new Set(progress.map((r) => `${r.person_id}:${r.requirement_id}`));
  const status = new Map(((tracked ?? []) as { person_id: string; item_id: string; status: string }[]).map((t) => [`${t.person_id}:${t.item_id}`, t.status]));
  const rankIdx = Object.fromEntries(ranks.map((r, i) => [r.id, i]));
  // A rank on record also earns the ranks before it.
  const highest = new Map<string, number>();
  for (const t of (tracked ?? []) as { person_id: string; item_id: string; status: string }[]) {
    if (t.status === "completed" && t.item_id in rankIdx) highest.set(t.person_id, Math.max(highest.get(t.person_id) ?? -1, rankIdx[t.item_id]));
  }
  const needOf = (itemId: string, reqId: string, isRank: boolean) => scoutIds.filter((pid) => {
    if (signed.has(`${pid}:${reqId}`)) return false;
    if (isRank) return (highest.get(pid) ?? -1) < rankIdx[itemId];
    const st = status.get(`${pid}:${itemId}`);
    return !!st && !["completed", "declined"].includes(st);
  }).length;

  const groups: ReqGroup[] = [
    ...ranks.map((r) => ({ name: r.name, kind: "rank" as const, items: tasks(r.requirements).map((q) => ({ id: q.id, label: `${r.name} ${q.number}`, text: short(q.text), need: needOf(r.id, q.id, true) })) })),
    ...badges.map((b) => ({ name: b.name, kind: "badge" as const, eagle: !!b.eagle_required, items: tasks(b.requirements).map((q) => ({ id: q.id, label: `${b.name} ${q.number}`, text: short(q.text), need: needOf(b.id, q.id, false) })) })),
  ].filter((g) => g.items.length);

  const tfcItems = ranks.filter((r) => (TFC_RANKS as readonly string[]).includes(r.code));
  const starter = starterModules(trailToFirstClass(tfcItems, {}, new Set()).all);
  const badgeStarter: Starter[] = badges.filter((b) => b.eagle_required).map((b, i) => ({ title: `${b.name} merit badge`, requirement_ids: tasks(b.requirements).map((q) => q.id), sort: 100 + i }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display font-extrabold text-[32px] m-0">Skill modules</h1>
          <p className="text-[14px] text-smoke m-0 mt-1">Plan what each meeting teaches, for any rank or merit badge. Scouts see it ahead of time with their own progress and videos.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/advancement" className="btn-secondary no-underline">← Advancement</Link>
          <Link href="/admin/advancement/tfc" className="btn-secondary no-underline">Trail to First Class</Link>
        </div>
      </div>
      <ModuleLibrary orgId={orgId} reqs={groups} modules={(mods ?? []) as Module[]} sessions={(sess ?? []) as Session[]}
        scoutsTotal={scoutIds.length} starter={starter} badgeStarter={badgeStarter} />
    </div>
  );
}

import Link from "next/link";
import { requireLeader } from "@/lib/context";
import { loadCatalog } from "@/lib/advancement";
import { TFC_RANKS, trailToFirstClass } from "@/lib/tfc";
import type { Progress } from "@/components/AdvancementClient";
import PrintButton from "@/components/PrintButton";

// Every Scout still on the Trail to First Class, and the requirements most of them still need,
// so the troop can plan meetings and campouts around them.
type Row = { person_id: string; requirement_id: string; completed_at: string | null; approved_by: string | null };

export default async function TfcTracker() {
  const { supabase, current } = await requireLeader();
  const orgId = current.org.id;
  const [items, { data: ms }, { data: pm }] = await Promise.all([
    loadCatalog(supabase),
    supabase.from("memberships").select("person_id, persons(first_name, last_name, type)").eq("org_id", orgId).eq("status", "active"),
    supabase.from("patrol_members").select("person_id, patrols(name)").eq("org_id", orgId).is("end_date", null),
  ]);
  const scouts = ((ms ?? []) as unknown as { person_id: string; persons: { first_name: string; last_name: string; type: string } }[])
    .filter((m) => m.persons?.type === "youth");
  const patrolOf = Object.fromEntries((pm ?? []).map((p) => [p.person_id, (p.patrols as unknown as { name: string } | null)?.name ?? ""]));
  const rankItems = items.filter((i) => i.kind === "rank" && i.program === "scouts_bsa" && (TFC_RANKS as readonly string[]).includes(i.code));
  const ids = scouts.map((s) => s.person_id);
  const reqIds = rankItems.flatMap((i) => i.requirements.map((r) => r.id));

  const [{ data: earnedRows }, progressRows] = await Promise.all([
    ids.length ? supabase.from("scout_advancement").select("person_id, item_id").in("person_id", ids).in("item_id", rankItems.map((i) => i.id)).eq("status", "completed") : Promise.resolve({ data: [] }),
    (async () => {
      const out: Row[] = [];
      if (!ids.length || !reqIds.length) return out;
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase.from("requirement_progress").select("person_id, requirement_id, completed_at, approved_by")
          .in("person_id", ids).in("requirement_id", reqIds).order("person_id").order("requirement_id").range(from, from + 999);
        out.push(...((data ?? []) as Row[]));
        if (!data || data.length < 1000) return out;
      }
    })(),
  ]);
  const codeOf = Object.fromEntries(rankItems.map((i) => [i.id, i.code]));

  // Group once, instead of scanning every row for every Scout.
  const progressOf = new Map<string, Progress>();
  for (const r of progressRows) {
    const p = progressOf.get(r.person_id) ?? {};
    p[r.requirement_id] = { completed_at: r.completed_at, approved_by: r.approved_by };
    progressOf.set(r.person_id, p);
  }
  const earnedOf = new Map<string, Set<string>>();
  for (const e of (earnedRows ?? []) as { person_id: string; item_id: string }[]) {
    earnedOf.set(e.person_id, (earnedOf.get(e.person_id) ?? new Set<string>()).add(codeOf[e.item_id]));
  }
  const onTrail = scouts.map((s) => ({ s, tfc: trailToFirstClass(rankItems, progressOf.get(s.person_id) ?? {}, earnedOf.get(s.person_id) ?? new Set()) }))
    .filter((x) => !x.tfc.finished)
    .sort((a, b) => a.tfc.done / (a.tfc.total || 1) - b.tfc.done / (b.tfc.total || 1) || a.s.persons.last_name.localeCompare(b.s.persons.last_name));

  // How many Scouts on the trail still need each requirement (not signed off and not waiting).
  const need = new Map<string, number>();
  for (const x of onTrail) for (const r of x.tfc.all) if (r.status === "todo") need.set(r.id, (need.get(r.id) ?? 0) + 1);
  const allReqs = onTrail[0]?.tfc.all ?? trailToFirstClass(rankItems, {}, new Set()).all;
  const mostNeeded = allReqs.map((r) => ({ r, n: need.get(r.id) ?? 0 })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 12);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display font-extrabold text-[32px] m-0">Trail to First Class</h1>
          <p className="text-[14px] text-smoke m-0 mt-1">{onTrail.length} {onTrail.length === 1 ? "Scout" : "Scouts"} working toward First Class. Plan meetings around what most of them still need.</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Link href="/admin/advancement" className="btn-secondary no-underline">← Advancement</Link>
          <PrintButton />
        </div>
      </div>

      {onTrail.length === 0 && <div className="card text-smoke">Every Scout has reached First Class.</div>}

      {mostNeeded.length > 0 && (
        <section className="card flex flex-col gap-3">
          <div className="font-bold text-[17px]">Most needed right now</div>
          <p className="text-[13px] text-smoke m-0">Teach one of these at the next meeting and most of your new Scouts move forward together.</p>
          <ol className="m-0 p-0 list-none flex flex-col">
            {mostNeeded.map(({ r, n }) => (
              <li key={r.id} className="flex gap-3 items-start py-2.5 border-t border-[#EAE4D6] first:border-0">
                <span className="font-display font-extrabold text-[20px] w-16 flex-none">{n}/{onTrail.length}</span>
                <span className="flex flex-col">
                  <span className="text-[13px] font-bold text-forest">{r.rankName} {r.number}</span>
                  <span className="text-[14px]">{r.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="card flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <div className="font-bold text-[17px]">Plan what the next meeting teaches</div>
          <p className="text-[13px] text-smoke m-0">Skill modules (knots, first aid, cooking...) for any rank or merit badge, scheduled on meeting dates. Scouts see them ahead of time with videos.</p>
        </div>
        <Link href="/admin/advancement/skills" className="btn-primary no-underline">Skill modules</Link>
      </section>

      {onTrail.length > 0 && (
        <section className="card p-0 overflow-x-auto">
          <table className="w-full border-collapse min-w-[640px] text-[14px]">
            <thead>
              <tr className="text-left text-smoke">
                <th className="px-4 py-2.5">Scout</th><th className="px-2">Patrol</th><th className="px-2">Overall</th>
                {onTrail[0].tfc.ranks.map((r) => <th key={r.code} className="px-2">{r.name}</th>)}
                <th className="px-2">Waiting</th>
              </tr>
            </thead>
            <tbody>
              {onTrail.map(({ s, tfc }) => {
                const pct = tfc.total ? Math.round((tfc.done / tfc.total) * 100) : 0;
                return (
                  <tr key={s.person_id} className="border-t border-[#EAE4D6]">
                    <td className="px-4 py-2.5"><Link href={`/scout/${s.person_id}/advancement`} className="font-bold text-ink no-underline">{s.persons.last_name}, {s.persons.first_name}</Link></td>
                    <td className="px-2 text-smoke">{patrolOf[s.person_id] ?? ""}</td>
                    <td className="px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 rounded-full overflow-hidden" style={{ background: "#EEE8D9" }}><div className="h-full" style={{ width: `${pct}%`, background: "#12355F" }} /></div>
                        <span className="font-bold">{pct}%</span>
                      </div>
                    </td>
                    {tfc.ranks.map((r) => <td key={r.code} className="px-2">{r.earned ? <b className="text-forest">Earned</b> : `${r.done}/${r.total}`}</td>)}
                    <td className="px-2">{tfc.waiting.length || ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

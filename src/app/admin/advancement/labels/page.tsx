import Link from "next/link";
import { requireLeader } from "@/lib/context";
import PrintButton from "@/components/PrintButton";
import { fmtDate } from "@/components/ui";

// Avery 5160 address labels (3 across, 10 down, 30 per sheet): one label per earned award that hasn't
// been presented yet, for award cards and Scout Shop bags. Print at 100% scale (no "fit to page").
type A = { adv_id: string; scout: string; item: string; completed_at: string };

export default async function AwardLabels() {
  const { supabase, current } = await requireLeader();
  const { data } = await supabase.rpc("awards_to_buy", { p_org: current.org.id });
  const awards = ((data ?? []) as A[]).sort((a, b) => a.scout.localeCompare(b.scout) || a.item.localeCompare(b.item));

  return (
    <div className="flex flex-col gap-4">
      <style>{`
        .sheet { display: grid; grid-template-columns: repeat(3, 2.625in); column-gap: 0.125in; row-gap: 0; }
        .label { height: 1in; box-sizing: border-box; padding: 0.12in 0.1in; overflow: hidden; display: flex; flex-direction: column; justify-content: center; font-size: 11pt; line-height: 1.15; }
        @media print { @page { size: letter; margin: 0.5in 0.1875in; } .sheet { break-inside: auto; } }
      `}</style>
      <div className="flex gap-2 items-center flex-wrap print:hidden">
        <Link href="/admin/advancement" className="btn-secondary no-underline">← Advancement</Link>
        <PrintButton />
        <span className="text-[13px] text-smoke">{awards.length} labels, {Math.ceil(awards.length / 30) || 0} {Math.ceil(awards.length / 30) === 1 ? "sheet" : "sheets"} of Avery 5160. Print at 100% scale.</span>
      </div>
      {awards.length === 0 && <div className="card text-smoke print:hidden">No earned awards are waiting to be presented.</div>}
      <div className="sheet">
        {awards.map((a) => (
          <div key={a.adv_id} className="label">
            <b>{a.scout}</b>
            <span>{a.item}</span>
            <span style={{ fontSize: "9pt" }}>{fmtDate(a.completed_at, { month: "short", day: "numeric", year: "numeric" })}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

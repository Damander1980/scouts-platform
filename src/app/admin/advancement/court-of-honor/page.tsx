import Link from "next/link";
import { requireLeader } from "@/lib/context";
import PrintButton from "@/components/PrintButton";

// Printable Court of Honor packet from awards_to_buy (completed, not yet presented):
// page 1 is the Scout Shop shopping list with counts, page 2 is the ceremony program
// grouped by Scout, ranks first.

type A = { adv_id: string; scout: string; item: string; kind: string; completed_at: string; purchased_at: string | null };
const KIND: Record<string, string> = { rank: "Ranks", badge: "Merit badges" };
const order = (k: string) => (k === "rank" ? 0 : k === "badge" ? 1 : 2);

export default async function CourtOfHonor() {
  const { supabase, current } = await requireLeader();
  const { data } = await supabase.rpc("awards_to_buy", { p_org: current.org.id });
  const awards = (data ?? []) as A[];

  const toBuy = awards.filter((a) => !a.purchased_at);
  const shop: Record<string, Record<string, number>> = {};
  for (const a of toBuy) { const g = (shop[KIND[a.kind] ?? "Other awards"] ??= {}); g[a.item] = (g[a.item] ?? 0) + 1; }

  const byScout: Record<string, A[]> = {};
  for (const a of awards) (byScout[a.scout] ??= []).push(a);
  const scouts = Object.keys(byScout).sort((a, b) => a.split(" ").slice(-1)[0].localeCompare(b.split(" ").slice(-1)[0]));

  return (
    <div className="flex flex-col gap-5 text-[14px]">
      <style>{`@media print { .coh-page { page-break-after: always } }`}</style>
      <div className="flex gap-2 print:hidden">
        <Link href="/admin/advancement" className="btn-secondary no-underline">← Advancement</Link>
        <PrintButton />
      </div>

      <section className="coh-page flex flex-col gap-3">
        <div>
          <div className="font-bold text-smoke">{current.org.name}</div>
          <h1 className="font-display font-extrabold text-[28px] m-0">Court of Honor shopping list</h1>
          <p className="text-smoke m-0">{toBuy.length} award{toBuy.length === 1 ? "" : "s"} still to buy. Bring the Scoutbook advancement report; most Scout Shops need it.</p>
        </div>
        {toBuy.length === 0 && <div className="card text-smoke">Everything earned has been bought.</div>}
        {Object.entries(shop).sort((a, b) => a[0].localeCompare(b[0])).map(([group, items]) => (
          <div key={group} className="card break-inside-avoid">
            <div className="font-bold text-[15px] mb-1">{group}</div>
            {Object.entries(items).sort((a, b) => a[0].localeCompare(b[0])).map(([item, n]) => (
              <div key={item} className="flex justify-between border-b py-1" style={{ borderColor: "#E3EAE6" }}><span>[ ] {item}</span><b>{n}</b></div>
            ))}
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <div className="font-bold text-smoke">{current.org.name}</div>
          <h1 className="font-display font-extrabold text-[28px] m-0">Court of Honor program</h1>
          <p className="text-smoke m-0">Awards to present, by Scout. Ranks first.</p>
        </div>
        {scouts.length === 0 && <div className="card text-smoke">Nothing waiting to be presented.</div>}
        {scouts.map((s) => (
          <div key={s} className="card break-inside-avoid">
            <div className="font-bold text-[16px]">{s}</div>
            {byScout[s].sort((a, b) => order(a.kind) - order(b.kind) || a.item.localeCompare(b.item)).map((a) => (
              <div key={a.adv_id} className="flex justify-between">
                <span>{a.item}{a.kind === "rank" ? " (rank)" : ""}</span>
                <span className="text-smoke">{a.purchased_at ? "bought" : "not bought yet"}</span>
              </div>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}

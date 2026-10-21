import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PrintButton from "@/components/PrintButton";
import { fmtDate } from "@/components/ui";

// Printable advancement history for one Scout (boards of review, Eagle applications, a family's
// own records). Reads only what the viewer may see: row security limits it to the Scout's family,
// the Scout, and leaders. Scoutbook stays the official record.
const RANKS = ["scout", "tenderfoot", "second_class", "first_class", "star", "life", "eagle"];

export default async function AdvancementPrint({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: scout } = await supabase.from("persons").select("id, first_name, last_name").eq("id", id).maybeSingle();
  if (!scout) notFound();

  const [{ data: adv }, { data: positions }, { data: membership }] = await Promise.all([
    supabase.from("scout_advancement").select("status, completed_at, advancement_items(name, kind, code, eagle_required)").eq("person_id", id),
    supabase.from("leadership_positions").select("title, start_date, end_date").eq("person_id", id).order("start_date"),
    supabase.from("memberships").select("organizations(name)").eq("person_id", id).eq("status", "active").limit(1).maybeSingle(),
  ]);
  type A = { status: string; completed_at: string | null; advancement_items: { name: string; kind: string; code: string; eagle_required: boolean } };
  const rows = (adv ?? []) as unknown as A[];
  const ranks = rows.filter((r) => r.advancement_items.kind === "rank" && r.status === "completed")
    .sort((a, b) => RANKS.indexOf(a.advancement_items.code) - RANKS.indexOf(b.advancement_items.code));
  const badges = rows.filter((r) => r.advancement_items.kind === "badge").sort((a, b) => a.advancement_items.name.localeCompare(b.advancement_items.name));
  const earned = badges.filter((b) => b.status === "completed");
  const working = badges.filter((b) => b.status !== "completed");
  const unit = (membership?.organizations as unknown as { name: string } | null)?.name ?? "";
  const d = (iso: string | null) => (iso ? fmtDate(iso, { month: "short", day: "numeric", year: "numeric" }) : "");

  return (
    <div className="max-w-3xl mx-auto p-6 text-[14px] bg-white min-h-screen flex flex-col gap-5">
      <div className="flex gap-2 print:hidden">
        <Link href={`/scout/${id}/advancement`} className="btn-secondary no-underline">← Back</Link>
        <PrintButton />
      </div>
      <div>
        <h1 className="font-display font-extrabold text-[26px] m-0">{scout.first_name} {scout.last_name}: advancement history</h1>
        <p className="m-0 text-smoke">{unit}{unit ? " · " : ""}Printed {d(new Date().toISOString())}. Scoutbook is the official record.</p>
      </div>

      <section className="break-inside-avoid">
        <h2 className="font-bold text-[16px] mb-1">Ranks</h2>
        {ranks.length === 0 ? <p className="m-0 text-smoke">No ranks recorded yet.</p> : (
          <table className="w-full border-collapse"><tbody>
            {ranks.map((r) => <tr key={r.advancement_items.code} className="border-b border-[#EAE4D6]"><td className="py-1.5 font-bold">{r.advancement_items.name}</td><td className="py-1.5 text-right">{d(r.completed_at)}</td></tr>)}
          </tbody></table>
        )}
      </section>

      <section className="break-inside-avoid">
        <h2 className="font-bold text-[16px] mb-1">Merit badges earned ({earned.length}, {earned.filter((b) => b.advancement_items.eagle_required).length} Eagle-required)</h2>
        {earned.length === 0 ? <p className="m-0 text-smoke">None yet.</p> : (
          <table className="w-full border-collapse"><tbody>
            {earned.map((b) => <tr key={b.advancement_items.code} className="border-b border-[#EAE4D6]"><td className="py-1.5">{b.advancement_items.name}{b.advancement_items.eagle_required ? " (Eagle-required)" : ""}</td><td className="py-1.5 text-right">{d(b.completed_at)}</td></tr>)}
          </tbody></table>
        )}
      </section>

      {working.length > 0 && (
        <section className="break-inside-avoid">
          <h2 className="font-bold text-[16px] mb-1">Merit badges in progress</h2>
          <p className="m-0">{working.map((b) => b.advancement_items.name).join(", ")}</p>
        </section>
      )}

      <section className="break-inside-avoid">
        <h2 className="font-bold text-[16px] mb-1">Leadership positions</h2>
        {(positions ?? []).length === 0 ? <p className="m-0 text-smoke">None recorded.</p> : (
          <table className="w-full border-collapse"><tbody>
            {(positions ?? []).map((p, i) => <tr key={i} className="border-b border-[#EAE4D6]"><td className="py-1.5">{p.title}</td><td className="py-1.5 text-right">{d(p.start_date)} – {p.end_date ? d(p.end_date) : "now"}</td></tr>)}
          </tbody></table>
        )}
      </section>
    </div>
  );
}

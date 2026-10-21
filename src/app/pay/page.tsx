import { requireOrg } from "@/lib/context";
import Shell from "@/components/Shell";
import { Chip, PageTitle, SectionLabel, fmtDate, money } from "@/components/ui";
import { householdBalance, loadFamily } from "@/lib/family";
import { paymentsEnabled } from "@/lib/stripe";
import PayClient from "./PayClient";

export default async function PayPage({ searchParams }: { searchParams: Promise<{ paid?: string }> }) {
  const { paid } = await searchParams;
  const ctx = await requireOrg();
  const { supabase, current, householdId } = ctx;
  const orgId = current.org.id;

  const [balance, { data: lines }, family] = await Promise.all([
    householdBalance(supabase, householdId, orgId),
    householdId ? supabase.from("ledger_entries").select("id, created_at, type, amount_cents, description, method, events(title)").eq("household_id", householdId).eq("org_id", orgId).order("created_at", { ascending: false }).limit(100) : Promise.resolve({ data: [] }),
    loadFamily(supabase, orgId),
  ]);
  const scouts = family.filter((f) => f.in_org && f.type === "youth");
  const { data: acct } = scouts.length
    ? await supabase.from("scout_account_entries").select("scout_id, amount_cents").eq("org_id", orgId).in("scout_id", scouts.map((s) => s.id))
    : { data: [] as { scout_id: string; amount_cents: number }[] };
  const scoutBal = scouts.map((s) => ({ id: s.id, name: s.first_name, cents: (acct ?? []).filter((a) => a.scout_id === s.id).reduce((t, a) => t + a.amount_cents, 0) }));

  return (
    <Shell ctx={ctx}>
      <PageTitle title="Pay" sub="Your family's account with the unit." />
      {paid && <div className="card font-bold" style={{ background: "#EEE8D9" }}>Thanks! Your payment is processing and will show below in a moment.</div>}

      <PayClient orgId={orgId} balance={balance} online={paymentsEnabled()} scoutBalances={scoutBal.filter((s) => s.cents > 0)} />

      <section className="flex flex-col gap-2">
        <SectionLabel>History</SectionLabel>
        {(lines ?? []).length === 0 && <div className="card text-smoke">No charges or payments yet.</div>}
        <div className="card p-0 overflow-hidden">
          {(lines ?? []).map((l) => (
            <div key={l.id} className="flex items-center gap-3 px-4 py-3 border-b border-[#EEE8D9] last:border-0">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[15px] truncate">{l.description || (l.events as unknown as { title: string })?.title || l.type}</div>
                <div className="text-[12px] text-smoke">{fmtDate(l.created_at, { month: "short", day: "numeric", year: "numeric" })}{l.method ? ` · ${l.method === "stripe" ? "card" : l.method}` : ""}</div>
              </div>
              <Chip tone={l.amount_cents > 0 ? "orange" : "green"}>{l.type}</Chip>
              <div className="font-bold text-[15px] w-24 text-right" style={{ color: l.amount_cents > 0 ? "#5E4400" : "#12355F" }}>
                {l.amount_cents > 0 ? money(l.amount_cents) : `−${money(-l.amount_cents)}`}
              </div>
            </div>
          ))}
        </div>
      </section>
    </Shell>
  );
}

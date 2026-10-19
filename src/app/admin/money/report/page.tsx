import Link from "next/link";
import { requirePerm } from "@/lib/context";
import { money } from "@/components/ui";
import PrintButton from "@/components/PrintButton";

// Monthly or year-end treasurer report. ?period=2026-10 for a month, ?period=2026 for a year.
// Family payments live in ledger_entries; the unit's own income and expenses (donations,
// paid reimbursements, manual entries) live in unit_transactions. Donations are read only
// from unit_transactions so they are never counted twice.

type Ledger = { amount_cents: number; type: string; method: string | null; created_at: string; events: { title: string } | null };
type Tx = { kind: string; category: string; amount_cents: number; occurred_on: string };
type Line = { kind: string; category: string; planned_cents: number };

function range(period: string) {
  if (/^\d{4}$/.test(period)) {
    const y = Number(period);
    return { start: `${y}-01-01`, end: `${y + 1}-01-01`, label: `${y} year-end report`, year: true };
  }
  const [y, m] = period.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const label = new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return { start: `${y}-${String(m).padStart(2, "0")}-01`, end: next, label: `${label} treasurer report`, year: false };
}

function sumBy<T>(rows: T[], key: (r: T) => string, val: (r: T) => number) {
  const out: Record<string, number> = {};
  for (const r of rows) out[key(r)] = (out[key(r)] ?? 0) + val(r);
  return Object.entries(out).sort((a, b) => b[1] - a[1]);
}

function Table({ title, rows, empty, total }: { title: string; rows: [string, number][]; empty: string; total?: boolean }) {
  return (
    <div className="card flex flex-col gap-1 break-inside-avoid">
      <div className="font-bold text-[15px] mb-1">{title}</div>
      {rows.length === 0 && <div className="text-[13px] text-smoke">{empty}</div>}
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between text-[14px] border-b py-1" style={{ borderColor: "#E3EAE6" }}><span>{k}</span><span>{money(v)}</span></div>
      ))}
      {total && rows.length > 0 && (
        <div className="flex justify-between text-[14px] font-bold pt-1"><span>Total</span><span>{money(rows.reduce((s, [, v]) => s + v, 0))}</span></div>
      )}
    </div>
  );
}

export default async function TreasurerReport({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period: raw } = await searchParams;
  const { supabase, current } = await requirePerm("money.view");
  const orgId = current.org.id;
  const now = new Date();
  const period = raw && /^\d{4}(-\d{2})?$/.test(raw) ? raw : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const r = range(period);

  const [{ data: ledger }, { data: tx }, { data: balances }, { data: budgets }] = await Promise.all([
    supabase.from("ledger_entries").select("amount_cents, type, method, created_at, events(title)").eq("org_id", orgId).gte("created_at", r.start).lt("created_at", r.end),
    supabase.from("unit_transactions").select("kind, category, amount_cents, occurred_on").eq("org_id", orgId).gte("occurred_on", r.start).lt("occurred_on", r.end),
    supabase.rpc("unit_balances", { p_org: orgId }),
    supabase.from("budgets").select("fiscal_year, starts_on, ends_on, approved_at, budget_lines(kind, category, planned_cents)").eq("org_id", orgId).lte("starts_on", r.end).gte("ends_on", r.start).order("starts_on", { ascending: false }).limit(1),
  ]);

  const L = (ledger ?? []) as unknown as Ledger[];
  const T = (tx ?? []) as Tx[];
  const payments = L.filter((l) => l.type === "payment");
  const refunds = L.filter((l) => l.type === "refund");
  const charges = L.filter((l) => l.type === "charge");
  const credits = L.filter((l) => l.type === "credit");

  const familyIn = payments.reduce((s, l) => s - l.amount_cents, 0);
  const refundsOut = refunds.reduce((s, l) => s + l.amount_cents, 0);
  const unitIn = T.filter((t) => t.kind === "income").reduce((s, t) => s + t.amount_cents, 0);
  const unitOut = T.filter((t) => t.kind === "expense").reduce((s, t) => s + t.amount_cents, 0);
  const totalIn = familyIn + unitIn;
  const totalOut = refundsOut + unitOut;

  const bal = (balances ?? []) as { household_name: string; balance_cents: number }[];
  const owed = bal.filter((b) => b.balance_cents > 0).sort((a, b) => b.balance_cents - a.balance_cents);
  const creditHeld = bal.filter((b) => b.balance_cents < 0).reduce((s, b) => s - b.balance_cents, 0);

  const budget = (budgets ?? [])[0] as unknown as { fiscal_year: string; approved_at: string | null; budget_lines: Line[] } | undefined;

  const prev = r.year ? String(Number(period) - 1) : (() => { const d = new Date(r.start + "T12:00:00"); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();
  const next = r.year ? String(Number(period) + 1) : (() => { const d = new Date(r.start + "T12:00:00"); d.setMonth(d.getMonth() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();
  const thisYear = period.slice(0, 4);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 flex-wrap print:hidden">
        <Link className="btn-secondary no-underline" href="/admin/money">← Money</Link>
        <Link className="btn-secondary no-underline" href={`/admin/money/report?period=${prev}`}>← {r.year ? prev : "Previous month"}</Link>
        <Link className="btn-secondary no-underline" href={`/admin/money/report?period=${next}`}>{r.year ? next : "Next month"} →</Link>
        {r.year
          ? <Link className="btn-secondary no-underline" href={`/admin/money/report`}>Monthly report</Link>
          : <Link className="btn-secondary no-underline" href={`/admin/money/report?period=${thisYear}`}>{thisYear} year-end report</Link>}
        <PrintButton />
      </div>

      <div>
        <div className="text-[14px] font-bold text-smoke">{current.org.name}</div>
        <h1 className="font-display font-extrabold text-[28px] m-0">{r.label}</h1>
        <p className="text-[13px] text-smoke m-0 mt-1">Prepared {now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} for the unit committee.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card"><div className="text-[11px] font-bold tracking-widest uppercase text-smoke">Money in</div><div className="font-display font-extrabold text-[24px] mt-1">{money(totalIn)}</div></div>
        <div className="card"><div className="text-[11px] font-bold tracking-widest uppercase text-smoke">Money out</div><div className="font-display font-extrabold text-[24px] mt-1">{money(totalOut)}</div></div>
        <div className="card"><div className="text-[11px] font-bold tracking-widest uppercase text-smoke">Net</div><div className="font-display font-extrabold text-[24px] mt-1" style={{ color: totalIn - totalOut < 0 ? "#A52A1C" : undefined }}>{money(totalIn - totalOut)}</div></div>
        <div className="card"><div className="text-[11px] font-bold tracking-widest uppercase text-smoke">Families owe (today)</div><div className="font-display font-extrabold text-[24px] mt-1">{money(owed.reduce((s, b) => s + b.balance_cents, 0))}</div></div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <Table title="Family payments received" total empty="No family payments this period."
          rows={sumBy(payments, (l) => l.method === "stripe" ? "Online (card)" : l.method ? l.method[0].toUpperCase() + l.method.slice(1) : "Other", (l) => -l.amount_cents)} />
        <Table title="Other unit income" total empty="No other income recorded."
          rows={sumBy(T.filter((t) => t.kind === "income"), (t) => t.category, (t) => t.amount_cents)} />
        <Table title="Unit expenses" total empty="No expenses recorded."
          rows={sumBy(T.filter((t) => t.kind === "expense"), (t) => t.category, (t) => t.amount_cents)} />
        <Table title="Refunds paid to families" total empty="No refunds this period."
          rows={refunds.length ? [["Card refunds", refundsOut]] : []} />
        <Table title="Charges billed to families" total empty="No charges posted."
          rows={sumBy(charges, (l) => l.events?.title ?? "Dues and other charges", (l) => l.amount_cents)} />
        <Table title="Credits given to families" total empty="No credits given."
          rows={sumBy(credits, (l) => l.events?.title ? `Canceled: ${l.events.title}` : "Adjustments", (l) => -l.amount_cents)} />
      </div>

      {r.year && (
        <div className="card flex flex-col gap-1 break-inside-avoid">
          <div className="font-bold text-[15px] mb-1">Budget versus actual{budget ? ` (${budget.fiscal_year}${budget.approved_at ? ", committee approved" : ", draft"})` : ""}</div>
          {!budget && <div className="text-[13px] text-smoke">No budget covers this year.</div>}
          {budget && (["income", "expense"] as const).map((kind) => {
            const lines = budget.budget_lines.filter((l) => l.kind === kind);
            if (!lines.length) return null;
            return (
              <div key={kind} className="flex flex-col">
                <div className="text-[12px] font-bold uppercase tracking-widest text-smoke mt-2">{kind}</div>
                <div className="grid grid-cols-4 text-[12px] font-bold text-smoke py-1"><span>Category</span><span className="text-right">Planned</span><span className="text-right">Actual</span><span className="text-right">Difference</span></div>
                {lines.map((l) => {
                  const a = T.filter((t) => t.kind === kind && t.category === l.category).reduce((s, t) => s + t.amount_cents, 0);
                  return (
                    <div key={l.category} className="grid grid-cols-4 text-[14px] border-b py-1" style={{ borderColor: "#E3EAE6" }}>
                      <span>{l.category}</span><span className="text-right">{money(l.planned_cents)}</span><span className="text-right">{money(a)}</span>
                      <span className="text-right" style={{ color: (kind === "expense" ? a > l.planned_cents : a < l.planned_cents) ? "#A52A1C" : undefined }}>{money(a - l.planned_cents)}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {budget && <div className="text-[12px] text-smoke mt-2">Actuals come from the unit ledger. Family payments for events and dues are shown above and are not split across budget lines.</div>}
        </div>
      )}

      <div className="card flex flex-col gap-1 break-inside-avoid">
        <div className="font-bold text-[15px] mb-1">Open family balances (as of today)</div>
        {owed.length === 0 && <div className="text-[13px] text-smoke">No family owes money.</div>}
        {owed.map((b) => (
          <div key={b.household_name} className="flex justify-between text-[14px] border-b py-1" style={{ borderColor: "#E3EAE6" }}><span>{b.household_name}</span><span>{money(b.balance_cents)}</span></div>
        ))}
        {creditHeld > 0 && <div className="text-[13px] text-smoke mt-1">Credits held for families: {money(creditHeld)}</div>}
      </div>

      <div className="text-[12px] text-smoke">
        Ledger entries are never edited; corrections appear as new lines. Family payments include online card payments (before Stripe fees) and cash or checks recorded by the treasurer.
      </div>
    </div>
  );
}

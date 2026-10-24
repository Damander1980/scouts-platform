"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";
import { Chip, ErrorBox, Field, Stat, money, fmtDate } from "@/components/ui";
import DuesTab, { type DuesPlan } from "./DuesTab";
import { checkSaved } from "@/lib/saved";

type Balance = { household_id: string; household_name: string; balance_cents: number; charges: number; paid: number; last_activity: string };
type Household = { household_id: string; household_name: string; members: string };
type Expense = { id: string; requester: string; event: string | null; category: string; amount_cents: number; description: string; receipt_path: string | null; status: string; created_at: string; approved_by: string | null };
type Budget = { id: string; fiscal_year: string; starts_on: string; ends_on: string; approved_at: string | null; alert_pct: number; budget_lines: { id: string; kind: string; category: string; planned_cents: number }[] };
type Tx = { kind: string; category: string; amount_cents: number; occurred_on: string };
type Campaign = { id: string; slug: string; title: string; description: string | null; target_cents: number | null; active: boolean; goal_id: string | null };
type Goal = { id: string; title: string; description: string | null; target_cents: number; deadline: string | null; is_public: boolean };
type Donation = { campaign_id: string | null; amount_cents: number; source: string | null; created_at: string };
type Fundraiser = { id: string; name: string; goal_id: string | null; target_cents: number | null; scout_share_pct: number; starts_on: string | null; ends_on: string | null; money_earning_approved_on?: string | null };
type Sale = { fundraiser_id: string; scout_id: string | null; amount_cents: number };

const TABS: [string, string][] = [["balances", "Families"], ["dues", "Dues and charges"], ["expenses", "Reimbursements"], ["budget", "Budget"], ["fundraising", "Fundraising"]];
const CATEGORIES = ["Dues", "Camping", "Equipment", "Advancement & awards", "Training", "Fundraising", "Donations", "Program supplies", "Insurance & recharter", "Other"];
const dollars = (s: string) => Math.round(parseFloat(s || "0") * 100);

export default function MoneyClient(props: {
  orgId: string; myPersonId: string; isTreasurer: boolean; isAdmin: boolean; paymentsConfigured: boolean; stripeConnected: boolean; connectState: string | null;
  initialTab: string; balances: Balance[]; households: Household[]; expenses: Expense[]; budgets: Budget[]; transactions: Tx[];
  duesPlans: DuesPlan[]; campaigns: Campaign[]; goals: Goal[]; donations: Donation[]; fundraisers: Fundraiser[]; sales: Sale[]; scouts: { id: string; name: string }[];
}) {
  const { orgId, isTreasurer } = props;
  const supabase = createClient();
  const router = useRouter();
  const [tab, setTab] = useState(props.initialTab === "giving" || props.initialTab === "fundraisers" ? "fundraising" : props.initialTab);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>, success?: string) => {
    setBusy(true); setError(""); setOk("");
    try { await fn(); if (success) setOk(success); router.refresh(); } catch (e: any) { setError(e.message ?? String(e)); }
    setBusy(false);
  };

  const owed = props.balances.filter((b) => b.balance_cents > 0).reduce((s, b) => s + b.balance_cents, 0);
  const credit = props.balances.filter((b) => b.balance_cents < 0).reduce((s, b) => s - b.balance_cents, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display font-extrabold text-[32px] m-0">Money</h1>
          <p className="text-[14px] text-smoke m-0 mt-1">Charges and payments post automatically. <a href="/admin/money/report" className="font-bold text-forest">Treasurer reports</a></p>
        </div>
        {isTreasurer && <button className="btn-primary" onClick={() => { setTab("record"); setError(""); setOk(""); }}>Record cash or check</button>}
      </div>
      {!isTreasurer && <div className="card">You can view summaries. Only the treasurer, committee chair or a unit admin can record money.</div>}

      {!props.stripeConnected && isTreasurer && (
        <div className="card flex items-center justify-between gap-3 flex-wrap" style={{ background: "#FFF6D6", borderColor: "#F0DA8C" }}>
          <div>
            <div className="font-bold text-[15px]">Accept online payments</div>
            <div className="text-[13px] text-smoke">
              {!props.paymentsConfigured ? "Online payments will turn on once the platform's Stripe keys are added."
                : props.isAdmin ? "Connect your unit's bank account through Stripe. Money goes straight to the unit; we never hold it."
                : "A unit admin connects the unit's bank account through Stripe. Money goes straight to the unit; we never hold it."}
            </div>
          </div>
          {props.paymentsConfigured && props.isAdmin && (
            <button className="btn-primary" disabled={busy} onClick={() => run(async () => {
              const res = await fetch("/api/stripe/connect", { method: "POST" });
              const body = await res.json();
              if (!body.url) throw new Error(body.error ?? "Couldn't start Stripe setup");
              window.location.href = body.url;
            })}>Connect bank account</button>
          )}
        </div>
      )}
      {props.connectState === "done" && <div className="card font-bold" style={{ background: "#EEE8D9" }}>Stripe setup saved. Payments turn on once Stripe finishes verifying your unit.</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="Families owe" value={money(owed)} tone={owed ? "#5E4400" : undefined} />
        <Stat label="Credits held" value={money(credit)} />
        <Stat label="Reimbursements waiting" value={props.expenses.filter((e) => ["submitted", "approved", "second_approval"].includes(e.status)).length} />
      </div>

      <div role="tablist" aria-label="Money sections" className="flex gap-6 overflow-x-auto border-b-2 border-[#DDD6C5]">
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setError(""); setOk(""); }}
            className="min-h-[44px] -mb-[2px] px-0.5 bg-transparent border-0 border-b-[3px] cursor-pointer font-sans text-[15px] whitespace-nowrap"
            style={{ borderColor: tab === k ? "#F5B700" : "transparent", color: tab === k ? "#101B2D" : "#4B5568", fontWeight: tab === k ? 700 : 500 }}>{l}</button>
        ))}
      </div>
      <ErrorBox>{error}</ErrorBox>
      {ok && <div className="card font-bold" style={{ background: "#EEE8D9" }}>{ok}</div>}

      {tab === "balances" && <Balances balances={props.balances} />}
      {tab === "dues" && <DuesTab orgId={orgId} plans={props.duesPlans} canEdit={isTreasurer} />}
      {tab === "record" && <RecordEntry households={props.households} disabled={!isTreasurer || busy} onSave={(row) => run(async () => {
        const { error } = await supabase.rpc("record_manual", { p_org: orgId, ...row });
        if (error) throw error;
      }, "Recorded.")} />}
      {tab === "expenses" && <Expenses expenses={props.expenses} canAct={isTreasurer} busy={busy} myId={props.myPersonId} orgId={orgId} run={run} />}
      {tab === "budget" && <BudgetTab budgets={props.budgets} tx={props.transactions} canEdit={isTreasurer} busy={busy} orgId={orgId} run={run} />}
      {tab === "fundraising" && <>
        <Fundraisers {...props} busy={busy} run={run} />
        <Giving {...props} busy={busy} run={run} />
      </>}
    </div>
  );
}

function Balances({ balances }: { balances: Balance[] }) {
  const [q, setQ] = useState("");
  const [owingOnly, setOwingOnly] = useState(false);
  // Families who owe the most come first; that's who the treasurer follows up with.
  const rows = balances
    .filter((b) => (!q || b.household_name.toLowerCase().includes(q.toLowerCase())) && (!owingOnly || b.balance_cents > 0))
    .sort((a, b) => b.balance_cents - a.balance_cents || a.household_name.localeCompare(b.household_name));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3 flex-wrap items-center">
        <input className="input flex-1 min-w-[200px] max-w-md" placeholder="Find a family" aria-label="Find a family" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex items-center gap-2 text-[14px] font-bold min-h-[44px]"><input type="checkbox" className="w-5 h-5" checked={owingOnly} onChange={(e) => setOwingOnly(e.target.checked)} /> Only families who owe</label>
        <a className="ml-auto text-[14px] font-bold text-forest min-h-[44px] flex items-center" href="/messages/new?audience=owing">Message families who owe</a>
        <a className="text-[14px] font-bold text-forest min-h-[44px] flex items-center" href="/api/export/ledger.csv">Download ledger</a>
      </div>
      <div className="card p-0 overflow-hidden">
        {rows.length === 0 && <div className="p-5 text-smoke">{owingOnly ? "Nobody owes anything right now." : "No activity yet."}</div>}
        {rows.map((b) => (
          <div key={b.household_id} className="flex items-center gap-3 px-5 py-3.5 border-b border-[#EAE4D6] last:border-0">
            <div className="flex-1"><div className="font-bold">{b.household_name}</div>
              <div className="text-[12px] text-smoke">Charged {money(b.charges)} · paid or credited {money(b.paid)}</div></div>
            <span className="text-[14px] font-bold px-3 py-1 rounded-full"
              style={b.balance_cents > 0 ? { background: "#FFF6D6", color: "#5E4400" } : { background: "#EEE8D9", color: "#12355F" }}>
              {b.balance_cents > 0 ? `Owes ${money(b.balance_cents)}` : b.balance_cents < 0 ? `${money(-b.balance_cents)} credit` : "Paid up"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecordEntry({ households, disabled, onSave }: { households: Household[]; disabled: boolean; onSave: (r: Record<string, unknown>) => void }) {
  const [f, setF] = useState({ household: "", amount: "", type: "payment", method: "check", note: "" });
  return (
    <form className="card flex flex-col gap-3 max-w-xl" onSubmit={(e) => { e.preventDefault(); onSave({ p_household: f.household, p_amount: dollars(f.amount), p_type: f.type, p_method: f.method, p_note: f.note || null, p_event: null }); setF({ ...f, amount: "", note: "" }); }}>
      <div className="font-bold text-[16px]">Record money by hand</div>
      <p className="text-[13px] text-smoke m-0">For cash and checks, or a correction. It shows in the family&apos;s history marked as manual.</p>
      <Field label="Family">
        <select className="input" value={f.household} onChange={(e) => setF({ ...f, household: e.target.value })} required>
          <option value="">Choose…</option>
          {households.map((h) => <option key={h.household_id} value={h.household_id}>{h.household_name} ({h.members})</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="What"><select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
          <option value="payment">Payment received</option><option value="charge">Charge (e.g. dues)</option><option value="credit">Credit</option><option value="refund">Refund paid out</option>
        </select></Field>
        <Field label="Amount ($)"><input className="input" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required /></Field>
      </div>
      <Field label="Method"><select className="input" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
        <option value="check">Check</option><option value="cash">Cash</option><option value="adjustment">Adjustment</option><option value="other">Other</option>
      </select></Field>
      <Field label="Note"><input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Check #1042, annual dues" /></Field>
      <button className="btn-primary" disabled={disabled}>Record</button>
    </form>
  );
}

function Expenses({ expenses, canAct, busy, myId, orgId, run }: { expenses: Expense[]; canAct: boolean; busy: boolean; myId: string; orgId: string; run: (fn: () => Promise<void>, ok?: string) => void }) {
  const supabase = createClient();
  const [f, setF] = useState({ amount: "", description: "", category: "Camping" });
  const [file, setFile] = useState<File | null>(null);
  const act = (e: Expense, status: string) => run(async () => {
    // Paying books the expense in the same database step, once (migration 0058); older databases fall through.
    if (status === "paid") {
      const { error: rpcErr } = await supabase.rpc("pay_expense_request", { p_id: e.id });
      if (!rpcErr) return;
      if (rpcErr.code !== "PGRST202") throw rpcErr;
    }
    const patch: Record<string, unknown> = { status };
    if (status === "approved") patch.approved_by = myId;
    if (status === "second_approval") patch.second_approved_by = myId;
    if (status === "paid") patch.paid_at = new Date().toISOString();
    // Only book the expense if this request really moved to paid now (not already paid, not blocked).
    checkSaved(await supabase.from("expense_requests").update(patch).eq("id", e.id).neq("status", "paid").select("id"));
    if (status === "paid") {
      const { error: e2 } = await supabase.from("unit_transactions").insert({ org_id: orgId, kind: "expense", category: e.category, amount_cents: e.amount_cents, description: `Reimbursement: ${e.description}` });
      if (e2) throw e2;
    }
  });
  return (
    <div className="flex flex-col gap-3">
      <form className="card flex flex-col gap-3 max-w-xl" onSubmit={(ev) => { ev.preventDefault(); run(async () => {
        let path: string | null = null;
        if (file) {
          path = `${orgId}/${crypto.randomUUID()}-${file.name.replace(/[^A-Za-z0-9.]/g, "_")}`;
          const { error } = await supabase.storage.from("receipts").upload(path, file);
          if (error) throw new Error("Receipt upload failed: " + error.message);
        }
        const { error } = await supabase.from("expense_requests").insert({ org_id: orgId, requested_by: myId, amount_cents: dollars(f.amount), description: f.description, category: f.category, receipt_path: path });
        if (error) throw error;
        setF({ amount: "", description: "", category: "Camping" }); setFile(null);
      }, "Submitted for approval."); }}>
        <div className="font-bold text-[16px]">Ask to be reimbursed</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount ($)"><input className="input" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required /></Field>
          <Field label="Budget category"><select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        </div>
        <Field label="What for"><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} required placeholder="Groceries for Caprock campout" /></Field>
        <Field label="Receipt photo"><input type="file" accept="image/*,application/pdf" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
        <button className="btn-primary" disabled={busy}>Submit</button>
      </form>
      {expenses.map((e) => (
        <div key={e.id} className="card flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]"><div className="font-bold">{money(e.amount_cents)} · {e.description}</div>
            <div className="text-[12px] text-smoke">{e.requester} · {e.category} · {fmtDate(e.created_at, { month: "short", day: "numeric", year: "numeric" })}</div></div>
          <Chip tone={e.status === "paid" ? "green" : e.status === "rejected" ? "red" : "orange"}>{e.status.replace("_", " ")}</Chip>
          {canAct && e.status === "submitted" && <><button className="btn-secondary" disabled={busy} onClick={() => act(e, "approved")}>Approve</button><button className="btn-ghost" disabled={busy} onClick={() => act(e, "rejected")}>Reject</button></>}
          {canAct && e.status === "approved" && e.amount_cents >= 50000 && e.approved_by !== myId && <button className="btn-secondary" disabled={busy} onClick={() => act(e, "second_approval")}>Second approval</button>}
          {canAct && e.status === "approved" && e.amount_cents >= 50000 && e.approved_by === myId && <Chip>Needs a second approver</Chip>}
          {canAct && (e.status === "second_approval" || (e.status === "approved" && e.amount_cents < 50000)) && <button className="btn-primary" disabled={busy} onClick={() => act(e, "paid")}>Mark paid</button>}
        </div>
      ))}
    </div>
  );
}

function BudgetTab({ budgets, tx, canEdit, busy, orgId, run }: { budgets: Budget[]; tx: Tx[]; canEdit: boolean; busy: boolean; orgId: string; run: (fn: () => Promise<void>, ok?: string) => void }) {
  const supabase = createClient();
  const b = budgets[0];
  const [line, setLine] = useState({ kind: "expense", category: "Camping", planned: "" });
  const year = new Date().getFullYear();
  const actual = (kind: string, cat: string) => tx.filter((t) => b && t.kind === kind && t.category === cat && t.occurred_on >= b.starts_on && t.occurred_on <= b.ends_on).reduce((s, t) => s + t.amount_cents, 0);
  if (!b) return (
    <div className="card flex flex-col gap-3 max-w-xl">
      <div className="font-bold text-[16px]">No budget yet</div>
      <p className="text-[13px] text-smoke m-0">Most units run on a calendar year or a program year starting in August or September.</p>
      {canEdit && <button className="btn-primary" disabled={busy} onClick={() => run(async () => {
        const { error } = await supabase.from("budgets").insert({ org_id: orgId, fiscal_year: String(year), starts_on: `${year}-01-01`, ends_on: `${year}-12-31` });
        if (error) throw error;
      })}>Start the {year} budget</button>}
    </div>
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="card flex items-center justify-between flex-wrap gap-2">
        <div><div className="font-bold text-[16px]">{b.fiscal_year} budget</div>
          <div className="text-[13px] text-smoke">{b.approved_at ? `Approved by committee ${fmtDate(b.approved_at, { month: "short", day: "numeric", year: "numeric" })}` : "Draft — not yet approved by the committee"}</div></div>
        {canEdit && !b.approved_at && <button className="btn-secondary" disabled={busy} onClick={() => run(async () => {
          const { error } = await supabase.from("budgets").update({ approved_at: new Date().toISOString() }).eq("id", b.id);
          if (error) throw error;
        }, "Recorded committee approval.")}>Record committee approval</button>}
      </div>
      {(["income", "expense"] as const).map((kind) => (
        <div key={kind} className="card flex flex-col gap-2">
          <div className="font-bold text-[15px] capitalize">{kind}</div>
          {b.budget_lines.filter((l) => l.kind === kind).map((l) => {
            const a = actual(kind, l.category); const pct = l.planned_cents ? Math.round((a / l.planned_cents) * 100) : 0;
            return (
              <div key={l.id} className="flex flex-col gap-1">
                <div className="flex justify-between text-[14px]"><span className="font-bold">{l.category}</span>
                  <span>{money(a)} of {money(l.planned_cents)} {kind === "expense" && pct >= b.alert_pct && <Chip tone={pct >= 100 ? "red" : "orange"}>{pct}%</Chip>}</span></div>
                <div className="h-2 rounded-full" style={{ background: "#EAE4D6" }}><div className="h-2 rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: pct >= 100 && kind === "expense" ? "#A52A1C" : "#12355F" }} /></div>
              </div>
            );
          })}
        </div>
      ))}
      {canEdit && (
        <form className="card flex gap-2 flex-wrap items-end" onSubmit={(e) => { e.preventDefault(); run(async () => {
          const { error } = await supabase.from("budget_lines").insert({ org_id: orgId, budget_id: b.id, kind: line.kind, category: line.category, planned_cents: dollars(line.planned) });
          if (error) throw error; setLine({ ...line, planned: "" });
        }); }}>
          <Field label="Type"><select className="input" value={line.kind} onChange={(e) => setLine({ ...line, kind: e.target.value })}><option value="income">Income</option><option value="expense">Expense</option></select></Field>
          <Field label="Category"><select className="input" value={line.category} onChange={(e) => setLine({ ...line, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Planned ($)"><input className="input w-32" inputMode="decimal" value={line.planned} onChange={(e) => setLine({ ...line, planned: e.target.value })} required /></Field>
          <button className="btn-primary" disabled={busy}>Add line</button>
        </form>
      )}
    </div>
  );
}

function QR({ url }: { url: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => { QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: "#101B2D", light: "#FFFFFF" } }).then(setSrc).catch(() => {}); }, [url]);
  return src ? <img src={src} alt={`QR code for ${url}`} className="w-40 h-40 rounded-xl border border-border" /> : <div className="w-40 h-40" />;
}

function Giving(p: Parameters<typeof MoneyClient>[0] & { busy: boolean; run: (fn: () => Promise<void>, ok?: string) => void }) {
  const supabase = createClient();
  const site = typeof window !== "undefined" ? window.location.origin : "";
  const [g, setG] = useState({ title: "", target: "", deadline: "", description: "" });
  const [c, setC] = useState({ title: "", goal: "", approvedBy: "", approvedOn: "" });
  const raised = (goalId: string) =>
    p.donations.filter((d) => p.campaigns.find((x) => x.id === d.campaign_id)?.goal_id === goalId).reduce((s, d) => s + d.amount_cents, 0) +
    p.sales.filter((s) => p.fundraisers.find((f) => f.id === s.fundraiser_id)?.goal_id === goalId).reduce((s, x) => s + x.amount_cents, 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="card text-[13px]" style={{ background: "#F8F5EE" }}>
        <b>Scouting America rule:</b> units don&apos;t solicit donations on their own. Get approval from your chartered organization (or council) for each campaign and record it below; a campaign can&apos;t go live without it. Don&apos;t describe gifts as tax-deductible unless your chartered organization confirms it.
      </div>
      <div className="font-bold text-[16px]">Fundraising goals</div>
      {p.goals.map((goal) => {
        const r = raised(goal.id); const pct = Math.min(100, Math.round((r / goal.target_cents) * 100));
        return (
          <div key={goal.id} className="card flex flex-col gap-2">
            <div className="flex justify-between gap-2"><b>{goal.title}</b><span>{money(r)} of {money(goal.target_cents)}</span></div>
            <div className="h-3 rounded-full" style={{ background: "#EAE4D6" }}><div className="h-3 rounded-full" style={{ width: `${pct}%`, background: "#F5B700" }} /></div>
            <div className="flex gap-2 items-center text-[13px] text-smoke">{goal.deadline && <>By {fmtDate(goal.deadline, { month: "short", day: "numeric", year: "numeric" })} ·</>}{goal.is_public ? "Shown on public page" : "Members only"}</div>
          </div>
        );
      })}
      {p.isTreasurer && (
        <form className="card grid sm:grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); p.run(async () => {
          const { error } = await supabase.from("fundraising_goals").insert({ org_id: p.orgId, title: g.title, target_cents: dollars(g.target), deadline: g.deadline || null, description: g.description || null });
          if (error) throw error; setG({ title: "", target: "", deadline: "", description: "" });
        }, "Goal added."); }}>
          <Field label="New goal"><input className="input" value={g.title} onChange={(e) => setG({ ...g, title: e.target.value })} required placeholder="New troop tents" /></Field>
          <Field label="Target ($)"><input className="input" inputMode="decimal" value={g.target} onChange={(e) => setG({ ...g, target: e.target.value })} required /></Field>
          <Field label="Deadline"><input className="input" type="date" value={g.deadline} onChange={(e) => setG({ ...g, deadline: e.target.value })} /></Field>
          <div className="flex items-end"><button className="btn-primary w-full" disabled={p.busy}>Add goal</button></div>
        </form>
      )}

      <div className="font-bold text-[16px] mt-2">Donation campaigns</div>
      {p.campaigns.map((camp) => {
        const url = `${site}/give/${camp.slug}`;
        const total = p.donations.filter((d) => d.campaign_id === camp.id).reduce((s, d) => s + d.amount_cents, 0);
        return (
          <div key={camp.id} className="card flex gap-4 flex-wrap items-center">
            <QR url={`${url}?src=flyer`} />
            <div className="flex-1 min-w-[200px] flex flex-col gap-1">
              <div className="font-bold text-[16px]">{camp.title}</div>
              <div className="text-[13px] text-smoke">{money(total)} raised · {camp.active ? "Live" : "Off"}</div>
              <div className="text-[12px] break-all">{url}</div>
              <div className="flex gap-2 flex-wrap mt-1">
                <a className="btn-secondary no-underline" href={`/give/${camp.slug}/print`} target="_blank">Print flyer & table tent</a>
                <a className="btn-secondary no-underline" href={`/give/${camp.slug}?booth=1`} target="_blank">Booth mode</a>
              </div>
            </div>
          </div>
        );
      })}
      {p.isTreasurer && (
        <form className="card grid sm:grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); p.run(async () => {
          const { error } = await supabase.from("donation_campaigns").insert({
            org_id: p.orgId, title: c.title, goal_id: c.goal || null, approved_by_text: c.approvedBy || null, approved_on: c.approvedOn || null,
            active: !!(c.approvedBy && c.approvedOn),
          });
          if (error) throw error; setC({ title: "", goal: "", approvedBy: "", approvedOn: "" });
        }, "Campaign created."); }}>
          <Field label="Campaign name"><input className="input" value={c.title} onChange={(e) => setC({ ...c, title: e.target.value })} required placeholder="Summer camp scholarships" /></Field>
          <Field label="Counts toward goal"><select className="input" value={c.goal} onChange={(e) => setC({ ...c, goal: e.target.value })}><option value="">None</option>{p.goals.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select></Field>
          <Field label="Approved by" hint="Chartered organization or council contact"><input className="input" value={c.approvedBy} onChange={(e) => setC({ ...c, approvedBy: e.target.value })} placeholder="First Methodist Church (COR)" /></Field>
          <Field label="Approved on"><input className="input" type="date" value={c.approvedOn} onChange={(e) => setC({ ...c, approvedOn: e.target.value })} /></Field>
          <button className="btn-primary sm:col-span-2" disabled={p.busy}>Create campaign</button>
        </form>
      )}
    </div>
  );
}

function Fundraisers(p: Parameters<typeof MoneyClient>[0] & { busy: boolean; run: (fn: () => Promise<void>, ok?: string) => void }) {
  const supabase = createClient();
  const [f, setF] = useState({ name: "", kind: "product", goal: "", target: "", share: "0", approved: "", start: "", end: "" });
  const [sale, setSale] = useState<{ fid: string; scout: string; amount: string; customer: string }>({ fid: "", scout: "", amount: "", customer: "" });
  const [approval, setApproval] = useState<Record<string, string>>({});
  return (
    <div className="flex flex-col gap-4">
      <div className="card text-[13px]" style={{ background: "#F8F5EE" }}>
        <b>Scouting America rules:</b> file a Unit Money-Earning Application with your council before each fundraiser and record its approval date here (sales are blocked until you do).
        No raffles or games of chance. Scouts sell products on their merit, not as charity. A Scout&apos;s share stays in the unit for that Scout&apos;s Scouting costs and is never paid out in cash.
      </div>
      {p.fundraisers.map((fr) => {
        const s = p.sales.filter((x) => x.fundraiser_id === fr.id);
        const total = s.reduce((t, x) => t + x.amount_cents, 0);
        const byScout = Object.entries(s.reduce<Record<string, number>>((a, x) => (x.scout_id ? { ...a, [x.scout_id]: (a[x.scout_id] ?? 0) + x.amount_cents } : a), {}));
        return (
          <div key={fr.id} className="card flex flex-col gap-2">
            <div className="flex justify-between gap-2 flex-wrap"><b className="text-[16px]">{fr.name}</b><span>{money(total)}{fr.target_cents ? ` of ${money(fr.target_cents)}` : ""}</span></div>
            <div className="text-[13px] text-smoke">{fr.scout_share_pct}% of each sale goes to the selling Scout&apos;s account{fr.money_earning_approved_on ? ` · Money-Earning Application approved ${fmtDate(fr.money_earning_approved_on, { month: "short", day: "numeric", year: "numeric" })}` : ""}</div>
            {!fr.money_earning_approved_on && p.isTreasurer && (
              <div className="flex gap-2 items-center flex-wrap">
                <Chip tone="orange">Needs council approval date</Chip>
                {/* Saved on Save, not on every change: typing a year fires changes like 0002-10-24 along the way. */}
                <input type="date" aria-label="Council approval date" className="input w-auto" value={approval[fr.id] ?? ""} onChange={(e) => setApproval({ ...approval, [fr.id]: e.target.value })} />
                <button className="btn-secondary" disabled={p.busy || !approval[fr.id]} onClick={() => p.run(async () => {
                  const { error } = await supabase.from("fundraisers").update({ money_earning_approved_on: approval[fr.id] }).eq("id", fr.id);
                  if (error) throw error;
                }, "Approval recorded.")}>Save</button>
              </div>
            )}
            {byScout.length > 0 && <div className="flex gap-1.5 flex-wrap">{byScout.map(([sid, cents]) => <Chip key={sid}>{p.scouts.find((x) => x.id === sid)?.name ?? "Scout"}: {money(cents)}</Chip>)}</div>}
            {sale.fid === fr.id ? (
              <form className="flex gap-2 flex-wrap items-end" onSubmit={(e) => { e.preventDefault(); p.run(async () => {
                const { error } = await supabase.from("fundraiser_sales").insert({ org_id: p.orgId, fundraiser_id: fr.id, scout_id: sale.scout || null, amount_cents: dollars(sale.amount), customer: sale.customer || null, created_by: p.myPersonId });
                if (error) throw error; setSale({ fid: fr.id, scout: sale.scout, amount: "", customer: "" });
              }, "Sale recorded."); }}>
                <select className="input" value={sale.scout} onChange={(e) => setSale({ ...sale, scout: e.target.value })}><option value="">Unit sale (no Scout)</option>{p.scouts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                <input aria-label="$" className="input w-28" placeholder="$" inputMode="decimal" value={sale.amount} onChange={(e) => setSale({ ...sale, amount: e.target.value })} required />
                <input aria-label="Customer (optional)" className="input" placeholder="Customer (optional)" value={sale.customer} onChange={(e) => setSale({ ...sale, customer: e.target.value })} />
                <button className="btn-primary" disabled={p.busy}>Add sale</button>
              </form>
            ) : <button className="btn-secondary self-start" onClick={() => setSale({ fid: fr.id, scout: "", amount: "", customer: "" })}>Record sales</button>}
          </div>
        );
      })}
      {p.isTreasurer && (
        <form className="card grid sm:grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); p.run(async () => {
          const { error } = await supabase.from("fundraisers").insert({
            org_id: p.orgId, name: f.name, kind: f.kind, goal_id: f.goal || null, target_cents: f.target ? dollars(f.target) : null,
            scout_share_pct: parseInt(f.share || "0"), money_earning_approved_on: f.approved || null, starts_on: f.start || null, ends_on: f.end || null,
          });
          if (error) throw error; setF({ name: "", kind: "product", goal: "", target: "", share: "0", approved: "", start: "", end: "" });
        }, "Fundraiser added."); }}>
          <Field label="Fundraiser"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required placeholder="Fall popcorn sale" /></Field>
          <Field label="Kind"><select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="product">Product sale</option><option value="service">Service (car wash, etc.)</option><option value="event">Event (pancake breakfast)</option><option value="other">Other</option></select></Field>
          <Field label="Toward goal"><select className="input" value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })}><option value="">None</option>{p.goals.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select></Field>
          <Field label="Sales target ($)"><input className="input" inputMode="decimal" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} /></Field>
          <Field label="Scout's share of each sale (%)"><input className="input" inputMode="numeric" value={f.share} onChange={(e) => setF({ ...f, share: e.target.value })} /></Field>
          <Field label="Money-Earning Application approved on"><input className="input" type="date" value={f.approved} onChange={(e) => setF({ ...f, approved: e.target.value })} /></Field>
          <Field label="Starts"><input className="input" type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
          <Field label="Ends"><input className="input" type="date" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>
          <button className="btn-primary sm:col-span-2" disabled={p.busy}>Add fundraiser</button>
        </form>
      )}
    </div>
  );
}

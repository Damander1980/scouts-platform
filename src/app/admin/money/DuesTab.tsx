"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Chip, ErrorBox, Field, money } from "@/components/ui";

export type DuesPlan = { id: string; name: string; school_year: string; amount_cents: number; due_on: string | null; applies_to: string };
type Row = { person_id: string; first_name: string; last_name: string; household_id: string | null; household_name: string | null; charged_cents: number; adjusted_cents: number; family_balance_cents: number };

const yearDefault = () => { const n = new Date(); const y = n.getMonth() >= 6 ? n.getFullYear() : n.getFullYear() - 1; return `${y}-${String(y + 1).slice(2)}`; };

export default function DuesTab({ orgId, plans, canEdit }: { orgId: string; plans: DuesPlan[]; canEdit: boolean }) {
  const supabase = createClient();
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(plans[0]?.id ?? null);
  const [rows, setRows] = useState<Row[]>([]);
  const [f, setF] = useState({ name: `${yearDefault()} yearly dues`, year: yearDefault(), amount: "", due: "", applies: "youth" });
  const [adj, setAdj] = useState<{ pid: string; amount: string; reason: string } | null>(null);
  const [ok, setOk] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const plan = plans.find((p) => p.id === selected) ?? null;

  useEffect(() => {
    if (!selected) { setRows([]); return; }
    supabase.rpc("dues_status", { p_plan: selected }).then(({ data }) => setRows((data ?? []) as Row[]));
  }, [selected, supabase]);

  const run = async (fn: () => Promise<void>, msg?: string) => {
    setBusy(true); setError(""); setOk("");
    try { await fn(); if (msg) setOk(msg); router.refresh(); if (selected) { const { data } = await supabase.rpc("dues_status", { p_plan: selected }); setRows((data ?? []) as Row[]); } }
    catch (e: any) { setError(e.message ?? String(e)); }
    setBusy(false);
  };

  const notCharged = rows.filter((r) => r.charged_cents === 0 && r.household_id).length;
  const paidUp = rows.filter((r) => r.charged_cents > 0 && r.family_balance_cents <= 0).length;
  const owing = rows.filter((r) => r.charged_cents > 0 && r.family_balance_cents > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="card text-[13px]" style={{ background: "#F4F8F6" }}>
        Yearly dues are charged to each enrolled Scout&apos;s family on their ledger, once per Scout. Families pay a leader in person (cash or check, no fee) or online (the card fee is added so the unit never loses money).
        Scouting America&apos;s national registration is separate; add it as its own plan if your unit collects it for families.
      </div>
      <ErrorBox>{error}</ErrorBox>
      {ok && <div className="card font-bold" style={{ background: "#EAF0ED" }}>{ok}</div>}

      {canEdit && (
        <form className="card grid sm:grid-cols-5 gap-3 items-end" onSubmit={(e) => { e.preventDefault(); run(async () => {
          const { data: { user } } = await supabase.auth.getUser();
          const { data: me } = await supabase.from("persons").select("id").eq("user_id", user!.id).single();
          const { data, error } = await supabase.from("dues_plans").insert({
            org_id: orgId, name: f.name, school_year: f.year, amount_cents: Math.round(parseFloat(f.amount || "0") * 100), due_on: f.due || null, applies_to: f.applies, created_by: me!.id,
          }).select("id").single();
          if (error) throw error; setSelected(data.id); setF({ ...f, amount: "" });
        }, "Plan created. Review it, then charge families."); }}>
          <Field label="Plan name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
          <Field label="Year"><input className="input" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} required /></Field>
          <Field label="Amount per Scout ($)"><input className="input" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required /></Field>
          <Field label="Due date"><input className="input" type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></Field>
          <Field label="Charged to"><select className="input" value={f.applies} onChange={(e) => setF({ ...f, applies: e.target.value })}>
            <option value="youth">Each Scout</option><option value="adults">Each adult leader</option><option value="all">Everyone</option></select></Field>
          <button className="btn-primary sm:col-span-5" disabled={busy}>Create dues plan</button>
        </form>
      )}

      {plans.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {plans.map((p) => (
            <button key={p.id} onClick={() => setSelected(p.id)} className="px-3 py-1.5 rounded-full text-[13px] font-bold border cursor-pointer font-sans"
              style={{ background: selected === p.id ? "#1F5F4A" : "white", color: selected === p.id ? "white" : "#4D5F57", borderColor: selected === p.id ? "#1F5F4A" : "#D5DFDA" }}>{p.name}</button>
          ))}
        </div>
      )}

      {plan && (
        <div className="flex flex-col gap-3">
          <div className="card flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="font-bold text-[16px]">{plan.name} · {money(plan.amount_cents)} each</div>
              <div className="text-[13px] text-smoke">{plan.due_on ? `Due ${new Date(plan.due_on).toLocaleDateString()}` : "No due date"} · {paidUp} paid up · {owing.length} owe · {notCharged} not charged yet</div>
            </div>
            {canEdit && notCharged > 0 && (
              <button className="btn-primary" disabled={busy} onClick={() => run(async () => {
                const { data, error } = await supabase.rpc("charge_dues", { p_plan: plan.id }); if (error) throw error;
                setOk(`Charged ${data} ${data === 1 ? "family" : "families"}.`);
              })}>Charge {notCharged} now</button>
            )}
          </div>

          <div className="card p-0 overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead><tr className="text-left text-[11px] uppercase text-smoke"><th className="px-3 py-2">Scout</th><th className="px-2">Family</th><th className="px-2">Charged</th><th className="px-2">Family balance</th><th className="px-2">Status</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.person_id} className="border-t border-[#EAF0ED]">
                    <td className="px-3 py-2 font-bold">{r.last_name}, {r.first_name}</td>
                    <td className="px-2 text-smoke">{r.household_name ?? "No family"}</td>
                    <td className="px-2">{r.charged_cents ? money(Number(r.charged_cents)) : "—"}{Number(r.adjusted_cents) > 0 && <span className="text-[12px] text-smoke"> (−{money(Number(r.adjusted_cents))} adj.)</span>}</td>
                    <td className="px-2">{money(Number(r.family_balance_cents))}</td>
                    <td className="px-2">{!r.household_id ? <Chip tone="orange">Attach to a family</Chip> : !r.charged_cents ? <Chip>Not charged</Chip> : Number(r.family_balance_cents) <= 0 ? <Chip tone="green">Paid up</Chip> : <Chip tone="orange">Owes</Chip>}</td>
                    <td className="px-2 text-right">{canEdit && r.charged_cents > 0 && <button className="btn-ghost text-[13px]" onClick={() => setAdj({ pid: r.person_id, amount: "", reason: "" })}>Waive / reduce</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {adj && (
            <form className="card flex gap-2 flex-wrap items-end" onSubmit={(e) => { e.preventDefault(); run(async () => {
              const { error } = await supabase.rpc("adjust_dues", { p_plan: plan.id, p_person: adj.pid, p_credit_cents: Math.round(parseFloat(adj.amount || "0") * 100), p_reason: adj.reason });
              if (error) throw error; setAdj(null);
            }, "Adjustment recorded in the family ledger."); }}>
              <Field label="Credit amount ($)"><input className="input w-32" inputMode="decimal" value={adj.amount} onChange={(e) => setAdj({ ...adj, amount: e.target.value })} required /></Field>
              <Field label="Reason (kept in the ledger)"><input className="input" value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} required placeholder="Scholarship, second Scout discount…" /></Field>
              <button className="btn-primary" disabled={busy}>Apply</button><button type="button" className="btn-secondary" onClick={() => setAdj(null)}>Cancel</button>
            </form>
          )}
          <p className="text-[12px] text-smoke m-0">Charging again later only bills Scouts who joined since. Nobody is ever charged twice for the same plan.</p>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Chip, ErrorBox, Field, money, fmtDate } from "@/components/ui";

export type DuesPlan = { id: string; name: string; school_year: string; amount_cents: number; due_on: string | null; applies_to: string; category?: string };

const CATEGORIES: [string, string][] = [["dues", "Yearly dues"], ["camp", "Camp and trips"], ["gear", "T-shirts and gear"], ["fees", "Fees and registration"], ["other", "Other"]];
const catLabel = (c?: string) => CATEGORIES.find(([k]) => k === (c ?? "dues"))?.[1] ?? "Other";
type Row = { person_id: string; first_name: string; last_name: string; household_id: string | null; household_name: string | null; charged_cents: number; adjusted_cents: number; family_balance_cents: number };

type Template = "yearly" | "charge" | "welcome" | "reminder" | "custom";
const TEMPLATES: [Template, string][] = [["yearly", "Yearly dues"], ["charge", "Announce this charge (camp, T-shirts...)"], ["welcome", "Welcome, new member"], ["reminder", "Reminder to families who owe"], ["custom", "Write my own"]];

// Ready-to-edit notices: the troop's name, the plan, amount, due date and pay link filled in.
function draft(kind: Template, troop: string, plan: DuesPlan, site: string) {
  const amt = money(plan.amount_cents);
  const due = plan.due_on ? fmtDate(plan.due_on + "T12:00:00", { month: "long", day: "numeric", year: "numeric" }) : "";
  const pay = `Pay online at ${site}/pay, or give cash or a check to our treasurer.`;
  if (kind === "yearly") return { subject: `${plan.name}: ${amt} per Scout`, body:
    `Hi ${troop} families,

It's time for ${plan.name}: ${amt} per Scout${due ? `, due ${due}` : ""}. Dues cover things like insurance, patches and awards, troop gear and program supplies.

${pay}

Thank you for supporting our troop!` };
  if (kind === "charge") return { subject: `${plan.name}: ${amt}`, body:
    `Hi ${troop} families,

${plan.name} is ${amt} per Scout${due ? `, due ${due}` : ""}. It's been added to your family balance.

${pay}

Thank you!` };
  if (kind === "welcome") return { subject: `Welcome to ${troop}!`, body:
    `Welcome to ${troop}! We're glad your family is here.

To finish enrolling your Scout, ${plan.name} is ${amt} per Scout${due ? `, due ${due}` : ""}.

${pay}

You'll find upcoming meetings and campouts under Events. Reply here with any questions.` };
  if (kind === "reminder") return { subject: `Reminder: ${plan.name}`, body:
    `Hi ${troop} families,

A friendly reminder that ${plan.name} (${amt} per Scout) ${due ? `was due ${due}` : "is still open"}.

${pay}

If you've already paid, thank you, and please ignore this.` };
  return { subject: plan.name, body: "" };
}

const yearDefault = () => { const n = new Date(); const y = n.getMonth() >= 6 ? n.getFullYear() : n.getFullYear() - 1; return `${y}-${String(y + 1).slice(2)}`; };

export default function DuesTab({ orgId, plans, canEdit }: { orgId: string; plans: DuesPlan[]; canEdit: boolean }) {
  const supabase = createClient();
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(plans[0]?.id ?? null);
  const [rows, setRows] = useState<Row[]>([]);
  const [f, setF] = useState({ name: `${yearDefault()} yearly dues`, year: yearDefault(), amount: "", due: "", applies: "youth", category: "dues" });
  const [cat, setCat] = useState("all");
  const [adj, setAdj] = useState<{ pid: string; amount: string; reason: string } | null>(null);
  const [ok, setOk] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const plan = plans.find((p) => p.id === selected) ?? null;
  const [troop, setTroop] = useState("our troop");
  const [kind, setKind] = useState<Template>("yearly");
  const [note, setNote] = useState({ subject: "", body: "" });
  const [alsoCharge, setAlsoCharge] = useState(true);
  useEffect(() => {
    supabase.from("organizations").select("name").eq("id", orgId).maybeSingle().then(({ data }) => { if (data?.name) setTroop(data.name); });
  }, [orgId, supabase]);
  // Yearly dues get the dues message; camp, gear and fees get the general one.
  useEffect(() => { if (plan) setKind((plan.category ?? "dues") === "dues" ? "yearly" : "charge"); }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (plan) setNote(draft(kind, troop, plan, typeof window !== "undefined" ? window.location.origin : ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, troop, selected]);

  useEffect(() => {
    if (!selected) { setRows([]); return; }
    supabase.rpc("dues_status", { p_plan: selected }).then(({ data, error: dErr }) => {
      if (dErr) setError(`Couldn't load who owes dues: ${dErr.message}`); // never show an empty list as "nobody owes"
      setRows((data ?? []) as Row[]);
    });
  }, [selected, supabase]);

  const run = async (fn: () => Promise<void>, msg?: string) => {
    setBusy(true); setError(""); setOk("");
    try { await fn(); if (msg) setOk(msg); router.refresh(); if (selected) { const { data, error: dErr } = await supabase.rpc("dues_status", { p_plan: selected }); if (dErr) throw dErr; setRows((data ?? []) as Row[]); } }
    catch (e: any) { setError(e.message ?? String(e)); }
    setBusy(false);
  };

  const notCharged = rows.filter((r) => r.charged_cents === 0 && r.household_id).length;
  const paidUp = rows.filter((r) => r.charged_cents > 0 && r.family_balance_cents <= 0).length;
  const owing = rows.filter((r) => r.charged_cents > 0 && r.family_balance_cents > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="card text-[13px]" style={{ background: "#F8F5EE" }}>
        Yearly dues are charged to each enrolled Scout&apos;s family on their ledger, once per Scout. Families pay a leader in person (cash or check, no fee) or online (the card fee is added so the unit never loses money).
        Scouting America&apos;s national registration is separate; add it as its own plan if your unit collects it for families.
      </div>
      <ErrorBox>{error}</ErrorBox>
      {ok && <div className="card font-bold" style={{ background: "#EEE8D9" }}>{ok}</div>}

      {canEdit && (
        <form className="card grid sm:grid-cols-3 gap-3 items-end" onSubmit={(e) => { e.preventDefault(); run(async () => {
          const { data: { user } } = await supabase.auth.getUser();
          const { data: me } = user ? await supabase.from("persons").select("id").eq("user_id", user.id).maybeSingle() : { data: null };
          if (!me) throw new Error("Sign in again, then try once more.");
          const { data, error } = await supabase.from("dues_plans").insert({
            org_id: orgId, name: f.name, school_year: f.year, amount_cents: Math.round(parseFloat(f.amount || "0") * 100), due_on: f.due || null, applies_to: f.applies, created_by: me.id,
            ...(f.category !== "dues" ? { category: f.category } : {}),
          }).select("id").single();
          if (error) throw new Error(/category/.test(error.message) ? "Categories need the latest database update (migration 0076). Leave it on Yearly dues for now." : error.message); setSelected(data.id); setF({ ...f, amount: "" });
        }, "Plan created. Review it, then charge families."); }}>
          <Field label="Category"><select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {CATEGORIES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}</select></Field>
          <Field label="Name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required placeholder="e.g. Summer camp 2027" /></Field>
          <Field label="Year"><input className="input" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} required /></Field>
          <Field label="Amount per person ($)"><input className="input" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required /></Field>
          <Field label="Due date"><input className="input" type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></Field>
          <Field label="Charged to"><select className="input" value={f.applies} onChange={(e) => setF({ ...f, applies: e.target.value })}>
            <option value="youth">Each Scout</option><option value="adults">Each adult leader</option><option value="all">Everyone</option></select></Field>
          <button className="btn-primary sm:col-span-3" disabled={busy}>Create</button>
        </form>
      )}

      {plans.length > 0 && (
        <div className="flex gap-2 flex-wrap items-center">
          <select className="input w-auto h-10 min-h-[44px]" aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="all">All categories ({plans.length})</option>
            {CATEGORIES.filter(([k]) => plans.some((p) => (p.category ?? "dues") === k)).map(([k, label]) => (
              <option key={k} value={k}>{label} ({plans.filter((p) => (p.category ?? "dues") === k).length})</option>
            ))}
          </select>
          {plans.filter((p) => cat === "all" || (p.category ?? "dues") === cat).map((p) => (
            <button key={p.id} onClick={() => setSelected(p.id)} className="px-3 py-1.5 rounded-full text-[13px] font-bold border cursor-pointer font-sans"
              style={{ background: selected === p.id ? "#12355F" : "white", color: selected === p.id ? "white" : "#4B5568", borderColor: selected === p.id ? "#12355F" : "#DDD6C5", minHeight: 44 }}>{p.name}{cat === "all" && <span className="font-normal opacity-75"> · {catLabel(p.category)}</span>}</button>
          ))}
        </div>
      )}

      {plan && (
        <div className="flex flex-col gap-3">
          <div className="card flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="font-bold text-[16px]">{plan.name} · {money(plan.amount_cents)} each</div>
              <div className="text-[13px] text-smoke">{plan.due_on ? `Due ${fmtDate(plan.due_on, { month: "short", day: "numeric", year: "numeric" })}` : "No due date"} · {paidUp} paid up · {owing.length} owe · {notCharged} not charged yet</div>
            </div>
          </div>

          {canEdit && (
            <form className="card flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); run(async () => {
              let charged = 0;
              if (alsoCharge && kind !== "reminder" && notCharged > 0) {
                const { data, error } = await supabase.rpc("charge_dues", { p_plan: plan.id }); if (error) throw error;
                charged = Number(data) || 0;
              }
              if (!note.body.trim()) throw new Error("Write the message first.");
              // Parents and guardians of every family with a balance due (never the Scouts themselves).
              const { data: mid, error } = await supabase.rpc("send_message", { p_org: orgId, p_subject: note.subject || null, p_body: note.body, p_audience: "owing", p_ref: null, p_person_ids: null });
              if (error) throw new Error(charged ? `Charged ${charged} ${charged === 1 ? "family" : "families"}, but the message didn't send: ${error.message}` : error.message);
              fetch("/api/notify/message", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: mid }) }).catch(() => {});
              setOk(`${charged ? `Charged ${charged} ${charged === 1 ? "family" : "families"} and sent` : "Sent"} your message to every family that owes.`);
            }); }}>
              <div>
                <div className="font-bold text-[17px]">Send it out</div>
                <p className="text-[13px] text-smoke m-0">Pick a message, make it yours, and send it to the parents of every family that owes. Charging and the message go out together.</p>
              </div>
              {rows.length === 0 ? (
                <div className="rounded-xl p-3 text-[14px]" style={{ background: "#FFF6D6", color: "#5E4400" }}>
                  No Scouts are in your troop yet, so there&apos;s nobody to charge. <a href="/admin/members" className="font-bold">Invite families first</a>, then come back here.
                </div>
              ) : (
                <>
                  <Field label="Message">
                    <select className="input" value={kind} onChange={(e) => setKind(e.target.value as Template)}>
                      {TEMPLATES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                    </select>
                  </Field>
                  <Field label="Subject"><input className="input" value={note.subject} onChange={(e) => setNote({ ...note, subject: e.target.value })} maxLength={150} /></Field>
                  <Field label="What families will read"><textarea className="input" rows={9} value={note.body} onChange={(e) => setNote({ ...note, body: e.target.value })} /></Field>
                  {kind !== "reminder" && notCharged > 0 && (
                    <label className="flex items-start gap-3 text-[15px] min-h-[44px]">
                      <input type="checkbox" className="w-5 h-5 mt-0.5 flex-none" checked={alsoCharge} onChange={(e) => setAlsoCharge(e.target.checked)} />
                      <span>Also charge {notCharged} {notCharged === 1 ? "Scout" : "Scouts"} {money(plan.amount_cents)} each now (added to each family&apos;s balance)</span>
                    </label>
                  )}
                  <button className="btn-primary self-start" disabled={busy}>
                    {busy ? "Sending…" : alsoCharge && kind !== "reminder" && notCharged > 0 ? `Charge ${notCharged} and send` : "Send message"}
                  </button>
                </>
              )}
            </form>
          )}

          <div className="card p-0 overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead><tr className="text-left text-[11px] uppercase text-smoke"><th className="px-3 py-2">Scout</th><th className="px-2">Family</th><th className="px-2">Charged</th><th className="px-2">Family balance</th><th className="px-2">Status</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.person_id} className="border-t border-[#EEE8D9]">
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

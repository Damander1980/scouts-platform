"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ErrorBox, money } from "@/components/ui";

export default function PayClient({ orgId, balance, online, scoutBalances }: {
  orgId: string; balance: number; online: boolean; scoutBalances: { id: string; name: string; cents: number }[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [amount, setAmount] = useState((Math.max(balance, 0) / 100).toFixed(2));
  const [cover, setCover] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pay() {
    setBusy(true); setError("");
    const res = await fetch("/api/stripe/checkout", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountCents: Math.round(parseFloat(amount) * 100), coverFees: cover }),
    });
    const body = await res.json().catch(() => ({}));
    if (body.url) window.location.href = body.url;
    else { setError(body.error ?? "Couldn't start the payment."); setBusy(false); }
  }

  async function applyScout(id: string, cents: number) {
    setBusy(true); setError("");
    const { error } = await supabase.rpc("apply_scout_account", { p_org: orgId, p_scout: id, p_amount: Math.min(cents, Math.max(balance, 0)) });
    if (error) setError(error.message); else router.refresh();
    setBusy(false);
  }

  return (
    <section className="card flex flex-col gap-3" style={{ borderColor: balance > 0 ? "#FF6A1A" : undefined, borderWidth: balance > 0 ? 2 : 1 }}>
      <div>
        <div className="text-[12px] font-bold uppercase tracking-widest text-smoke">Balance</div>
        <div className="font-display font-extrabold text-[34px]" style={{ color: balance > 0 ? "#7A2E00" : "#1F5F4A" }}>
          {balance > 0 ? `You owe ${money(balance)}` : balance < 0 ? `${money(-balance)} credit` : "All paid up"}
        </div>
        {balance < 0 && <div className="text-[13px] text-smoke">Your credit is used automatically toward your next event.</div>}
      </div>
      <ErrorBox>{error}</ErrorBox>

      {scoutBalances.length > 0 && balance > 0 && scoutBalances.map((s) => (
        <div key={s.id} className="rounded-xl p-3 flex items-center justify-between gap-2" style={{ background: "#EAF0ED" }}>
          <span className="text-[14px]"><b>{s.name}</b> has {money(s.cents)} in fundraising earnings.</span>
          <button className="btn-secondary" disabled={busy} onClick={() => applyScout(s.id, s.cents)}>Use {money(Math.min(s.cents, balance))}</button>
        </div>
      ))}

      {balance > 0 && (online ? (
        <>
          <div className="flex items-center gap-2">
            <span className="text-[20px] font-bold">$</span>
            <input className="input w-36" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <label className="flex items-center gap-3 text-[14px]">
            <input type="checkbox" className="w-5 h-5" checked={cover} onChange={(e) => setCover(e.target.checked)} />
            Add the card fee so the unit gets the full amount
          </label>
          <button className="btn-primary" disabled={busy} onClick={pay}>{busy ? "Opening checkout…" : `Pay ${money(Math.round(parseFloat(amount || "0") * 100))}`}</button>
          <p className="text-[12px] text-smoke m-0">Card, Apple Pay or Google Pay through Stripe. Money goes straight to your unit; we never hold it.</p>
        </>
      ) : (
        <p className="text-[14px] m-0">Online payment isn&apos;t set up for this unit yet. Pay the treasurer by cash or check and they&apos;ll record it.</p>
      ))}
    </section>
  );
}

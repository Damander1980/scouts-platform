"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { familyFee, type PaymentPrefs } from "@/lib/fees";
import { ErrorBox, money } from "@/components/ui";

export default function PayClient({ orgId, balance, online, prefs, scoutBalances }: {
  orgId: string; balance: number; online: boolean; prefs: PaymentPrefs; scoutBalances: { id: string; name: string; cents: number }[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [amount, setAmount] = useState((Math.max(balance, 0) / 100).toFixed(2));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cents = Math.max(0, Math.round(parseFloat(amount || "0") * 100));
  const fee = familyFee(cents, prefs);
  const showCash = prefs.methods !== "card";
  const showCard = prefs.methods !== "cash";

  async function pay() {
    setBusy(true); setError("");
    const res = await fetch("/api/stripe/checkout", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amountCents: cents }),
    });
    const body = await res.json().catch(() => ({}));
    if (body.url) window.location.href = body.url;
    else { setError(body.error ?? "Couldn't start the payment."); setBusy(false); }
  }

  async function applyScout(id: string, c: number) {
    setBusy(true); setError("");
    const { error } = await supabase.rpc("apply_scout_account", { p_org: orgId, p_scout: id, p_amount: Math.min(c, Math.max(balance, 0)) });
    if (error) setError(error.message); else router.refresh();
    setBusy(false);
  }

  return (
    <section className="card flex flex-col gap-4">
      <div>
        <div className="text-[12px] font-bold uppercase tracking-widest text-smoke">Balance</div>
        <div className="font-display font-extrabold text-[34px]" style={{ color: balance > 0 ? "#5E4400" : "#12355F" }}>
          {balance > 0 ? `You owe ${money(balance)}` : balance < 0 ? `${money(-balance)} credit` : "All paid up"}
        </div>
        {balance < 0 && <div className="text-[13px] text-smoke">Your credit is used automatically toward your next event.</div>}
      </div>
      <ErrorBox>{error}</ErrorBox>

      {scoutBalances.length > 0 && balance > 0 && scoutBalances.map((s) => (
        <div key={s.id} className="rounded-xl p-3 flex items-center justify-between gap-2" style={{ background: "#EEE8D9" }}>
          <span className="text-[14px]"><b>{s.name}</b> has {money(s.cents)} in fundraising earnings.</span>
          <button className="btn-secondary" disabled={busy} onClick={() => applyScout(s.id, s.cents)}>Use {money(Math.min(s.cents, balance))}</button>
        </div>
      ))}

      {balance > 0 && (
        <div className={`grid gap-3 ${showCash && showCard ? "sm:grid-cols-2" : ""}`}>
          {showCash && <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: "#F8F5EE" }}>
            <div className="font-bold text-[15px]">Pay a leader in person</div>
            <div className="text-[13px] text-smoke">Cash or check. <b>No fee.</b> Hand it to your treasurer or a leader and they&apos;ll record it here.</div>
          </div>}
          {showCard && <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: "#F8F5EE", boxShadow: online ? "inset 0 0 0 2px #12355F" : undefined }}>
            <div className="font-bold text-[15px]">Pay online</div>
            {online ? (
              <>
                <div className="flex items-center gap-2"><span className="text-[18px] font-bold">$</span>
                  <input className="input w-32" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
                <div className="text-[13px] text-smoke">
                  {fee > 0
                    ? <>{money(cents)} + {money(fee)} card fee = <b>{money(cents + fee)}</b>. The fee goes to the card processor so your unit gets the full amount.</>
                    : <>No card fee. Your unit covers it.</>}
                </div>
                <button className="btn-primary" disabled={busy || cents < 50} onClick={pay}>{busy ? "Opening checkout…" : `Pay ${money(cents + fee)} by card`}</button>
              </>
            ) : <div className="text-[13px] text-smoke">Online payment isn&apos;t set up for this unit yet.</div>}
          </div>}
        </div>
      )}
    </section>
  );
}

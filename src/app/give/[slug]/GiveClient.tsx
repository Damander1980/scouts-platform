"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { money } from "@/components/ui";
import { coverFee } from "@/lib/fees";

type C = { slug: string; title: string; description: string | null; target_cents: number | null; org_name: string; org_slug: string; raised: number; connected: boolean };

export default function GiveClient({ campaign: c, thanks, booth, source }: { campaign: C; thanks: boolean; booth: boolean; source: string }) {
  const [amount, setAmount] = useState(2500);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [qr, setQr] = useState("");
  const gift = custom ? Math.max(0, Math.round(parseFloat(custom || "0") * 100) || 0) : amount;
  const pct = c.target_cents ? Math.min(100, Math.round((Number(c.raised) / c.target_cents) * 100)) : null;

  useEffect(() => {
    if (booth) QRCode.toDataURL(`${window.location.origin}/give/${c.slug}?src=booth`, { width: 640, margin: 1 }).then(setQr);
  }, [booth, c.slug]);

  async function give() {
    setBusy(true); setError("");
    const cents = custom ? Math.round(parseFloat(custom) * 100) : amount;
    const res = await fetch("/api/stripe/donate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaign: c.slug, amountCents: cents, source }) });
    const body = await res.json().catch(() => ({}));
    if (body.url) window.location.href = body.url; else { setError(body.error ?? "Couldn't start checkout"); setBusy(false); }
  }

  if (booth && qr) {
    return (
      <div className="min-h-screen bg-forest text-white flex flex-col items-center justify-center gap-6 p-6 text-center">
        <div className="font-display font-extrabold text-[36px] leading-tight">{c.title}</div>
        <img src={qr} alt="Scan to give" className="w-[min(80vw,420px)] rounded-3xl bg-white p-4" />
        <div className="text-[22px] font-bold">Scan with your phone camera to give</div>
        <div style={{ color: "#CFE0D7" }}>{c.org_name}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <div className="bg-forest text-white px-5 pt-12 pb-8">
        <div className="max-w-md mx-auto">
          <div className="text-[13px] font-bold" style={{ color: "#CFE0D7" }}>{c.org_name}</div>
          <h1 className="font-display font-extrabold text-[30px] leading-tight m-0 mt-1">{c.title}</h1>
          {pct !== null && (
            <div className="mt-4">
              <div className="h-3 rounded-full bg-white/20"><div className="h-3 rounded-full" style={{ width: `${pct}%`, background: "#F5B700" }} /></div>
              <div className="text-[14px] mt-1">{money(Number(c.raised))} raised of {money(c.target_cents!)}</div>
            </div>
          )}
        </div>
      </div>
      <div className="max-w-md mx-auto px-4 py-6 flex flex-col gap-4">
        {thanks ? (
          <div className="card text-center py-8"><div className="font-display font-bold text-[24px]">Thank you!</div><p className="text-smoke">A receipt is on its way to your email.</p></div>
        ) : (
          <>
            {c.description && <p className="text-[15px] m-0">{c.description}</p>}
            <div className="grid grid-cols-3 gap-2">
              {[1000, 2500, 5000, 10000, 25000].map((a) => (
                <button key={a} onClick={() => { setAmount(a); setCustom(""); }} className="min-h-[52px] rounded-xl border-2 font-bold text-[17px] cursor-pointer font-sans"
                  style={{ borderColor: !custom && amount === a ? "#12355F" : "#DDD6C5", background: !custom && amount === a ? "#EEE8D9" : "white" }}>{money(a).replace(".00", "")}</button>
              ))}
              <input className="input text-center" placeholder="Other" inputMode="decimal" value={custom} onChange={(e) => setCustom(e.target.value)} />
            </div>
            <div className="text-[13px] text-smoke">Giving online adds a card fee ({money(coverFee(gift))}) so {c.org_name} receives your full gift: total <b>{money(gift + coverFee(gift))}</b>. Prefer no fee? Hand your gift to a leader in person.</div>
            {error && <div className="text-[14px] font-bold" style={{ color: "#A52A1C" }}>{error}</div>}
            <button className="btn-primary" disabled={busy || !c.connected} onClick={give}>{busy ? "Opening…" : "Give with card, Apple Pay or Google Pay"}</button>
            {!c.connected && <div className="text-[13px] text-smoke">Online giving opens once the unit finishes connecting its bank account.</div>}
            <p className="text-[12px] text-smoke m-0">Secure payment by Stripe. Gifts go to {c.org_name}. We only collect your name and email for the receipt.</p>
          </>
        )}
      </div>
    </div>
  );
}

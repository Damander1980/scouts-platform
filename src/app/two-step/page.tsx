"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Two-step verification for admins, leaders and treasurers (SPEC: Trust and data protection).
// First visit: scan a QR code with an authenticator app. Later visits: enter the 6-digit code.
export default function TwoStepPage() {
  const supabase = createClient();
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

  const raw = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") ?? "/admin" : "/admin";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/admin";

  useEffect(() => {
    (async () => {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2") { window.location.href = next; return; }
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) { setError(error.message); setBusy(false); return; }
      const verified = data.totp.find((f) => f.status === "verified");
      if (verified) { setFactorId(verified.id); setBusy(false); return; }
      // Clear any half-finished setup, then start a fresh one.
      for (const f of data.all.filter((f) => f.status === "unverified")) await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data: en, error: e2 } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}` });
      if (e2) { setError(e2.message); setBusy(false); return; }
      setFactorId(en.id); setQr(en.totp.qr_code); setSecret(en.totp.secret);
      setBusy(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, "") });
    if (error) { setError("That code didn't work. Codes change every 30 seconds, so try the newest one."); setBusy(false); return; }
    window.location.href = next;
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-5 py-10">
      <form onSubmit={verify} className="w-full max-w-[460px] bg-white rounded-[20px] p-8 flex flex-col gap-4"
        style={{ boxShadow: "0 1px 2px rgba(16,27,45,.06), 0 14px 36px rgba(16,27,45,.12)" }}>
        <h1 className="font-display font-extrabold text-[28px] m-0">{qr ? "Set up two-step sign-in" : "Enter your code"}</h1>
        <p className="text-[15px] text-smoke m-0">
          {qr
            ? "Leader tools show children's information, so leaders, treasurers and admins confirm it's them with a code from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password and others)."
            : "Open your authenticator app and enter the 6-digit code for ScoutPlatform."}
        </p>
        {qr && (
          <div className="flex flex-col items-center gap-2 rounded-2xl p-4" style={{ background: "#EEE8D9" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR code to add ScoutPlatform to your authenticator app" width={180} height={180} className="bg-white rounded-xl p-2" />
            <span className="text-[13px] text-smoke text-center">1. Scan this in your app. Can&apos;t scan? Type this key: <code className="font-bold break-all">{secret}</code></span>
            <span className="text-[13px] text-smoke">2. Enter the 6-digit code it shows.</span>
          </div>
        )}
        <label htmlFor="code" className="font-bold text-sm">6-digit code</label>
        <input id="code" className="input w-full tracking-[0.3em] text-center text-[22px]" inputMode="numeric" autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus value={code} onChange={(e) => setCode(e.target.value)} disabled={busy && !factorId} />
        {error && <p role="alert" className="text-sm m-0 rounded-xl p-3" style={{ background: "#FFF6D6", color: "#5E4400" }}>{error}</p>}
        <button type="submit" className="btn-primary w-full disabled:opacity-50" disabled={busy || !factorId}>{busy ? "One moment…" : "Confirm"}</button>
        <a href="/dashboard" className="text-center text-[14px] font-bold text-forest min-h-[44px] flex items-center justify-center">Back to family view</a>
      </form>
    </div>
  );
}

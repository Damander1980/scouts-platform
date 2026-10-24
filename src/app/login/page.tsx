"use client";

import { useEffect, useState } from "react";
import { createClient, createEmailLinkClient } from "@/lib/supabase/client";
import Mark from "@/components/Mark";
import PasswordInput from "@/components/PasswordInput";
import { safeNext } from "@/lib/safeNext";

type Mode = "signin" | "signup" | "forgot";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  // Invite links open straight to account creation (?mode=signup); read after mount to avoid a hydration mismatch.
  useEffect(() => { if (new URLSearchParams(window.location.search).get("mode") === "signup") setMode("signup"); }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Only same-site paths, so a crafted link can't bounce someone to another site after sign-in.
  const rawNext = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") ?? "/home" : "/home";
  const next = safeNext(rawNext, "/home");

  function switchMode(m: Mode) { setMode(m); setError(""); setNotice(""); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(""); setNotice("");
    try {
      const supabase = createClient();
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw new Error(error.message === "Invalid login credentials" ? "That email and password don't match. Try again or reset your password." : error.message);
        window.location.href = next;
        return;
      }
      if (mode === "signup") {
        if (password.length < 8) throw new Error("Use at least 8 characters for your password.");
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { emailRedirectTo: `${location.origin}/auth/confirm?next=${encodeURIComponent(next)}` },
        });
        if (error) throw error;
        if (data.session) { window.location.href = next; return; }
        setNotice(`Almost done. We sent a confirmation to ${email.trim()}. Open it once, then sign in with your password.`);
      } else {
        const { error } = await createEmailLinkClient().auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${location.origin}/auth/confirm?next=${encodeURIComponent("/reset-password")}`,
        });
        if (error) throw error;
        setNotice(`If ${email.trim()} has an account, a reset link is on its way.`);
      }
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  async function google() {
    await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
  }

  const title = mode === "signin" ? "Sign in" : mode === "signup" ? "Create your account" : "Reset your password";
  const action = mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link";

  return (
    <div className="min-h-screen flex flex-wrap" style={{ background: "#E9E3D6" }}>
      <div className="text-white flex flex-col justify-between gap-10 px-10 py-12 relative overflow-hidden" style={{ flex: "1 1 420px", background: "var(--topo-dark), radial-gradient(120% 100% at 0% 100%, #1B4A80 0%, #12355F 45%, #0C2442 100%)", backgroundSize: "520px 520px, auto", boxShadow: "inset -4px 0 0 #F5B700" }}>
        {/* A dashed trail climbing to the summit marker: the brand's signature, quietly. */}
        <svg aria-hidden="true" viewBox="0 0 400 600" preserveAspectRatio="xMaxYMax slice" className="absolute inset-0 w-full h-full pointer-events-none"><path d="M40 620 C120 540 90 480 180 440 S300 360 260 280 S330 150 350 90" fill="none" stroke="#F5B700" strokeWidth="3" strokeDasharray="2 12" strokeLinecap="round" opacity=".7"/><path d="M350 72l9 16h-18z" fill="#F5B700"/></svg>
        <a href="/" className="relative flex items-center gap-3 no-underline text-white">
          <Mark size={40} />
          <span className="font-display font-extrabold text-[20px]">Our Troop Manager</span>
        </a>
        <div className="relative flex flex-col gap-4 max-w-md">
          <h1 className="font-display font-extrabold text-[44px] leading-[1.05] m-0">Your troop,<br /><span style={{ color: "#F5B700" }}>all in one place.</span></h1>
          <p className="text-[17px] m-0" style={{ color: "#D7E0EE" }}>Sign-ups, payments, health form status, advancement and messages for every family and leader.</p>
        </div>
        <p className="relative text-[13px] m-0" style={{ color: "#AEB9C9" }}>Not affiliated with Scouting America.</p>
      </div>

      <div className="flex items-center justify-center px-5 py-12" style={{ flex: "1 1 480px" }}>
        <div className="w-full max-w-[420px] bg-white rounded-[20px] p-8 flex flex-col gap-5"
          style={{ boxShadow: "0 1px 2px rgba(16,27,45,.06), 0 14px 36px rgba(16,27,45,.12)" }}>
          <h2 className="font-display font-extrabold text-[28px] m-0">{title}</h2>

          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="font-bold text-sm">Email</label>
              <input id="email" type="email" required autoFocus autoComplete="email" inputMode="email"
                value={email} onChange={(e) => setEmail(e.target.value)} className="input w-full" />
            </div>
            {mode !== "forgot" && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="font-bold text-sm">Password</label>
                  {mode === "signin" && (
                    <button type="button" onClick={() => switchMode("forgot")} className="text-[13px] font-bold text-forest bg-transparent border-none cursor-pointer min-h-[44px] px-0">Forgot password?</button>
                  )}
                </div>
                <PasswordInput id="password" required minLength={mode === "signup" ? 8 : undefined}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password} onChange={(e) => setPassword(e.target.value)} className="input w-full" />
                {mode === "signup" && <span className="text-[12px] text-smoke">At least 8 characters.</span>}
              </div>
            )}
            {error && <p role="alert" className="text-sm m-0 rounded-xl p-3" style={{ background: "#FFF6D6", color: "#5E4400" }}>{error}</p>}
            {notice && <p role="status" className="text-sm m-0 rounded-xl p-3" style={{ background: "#EEE8D9", color: "#12355F" }}>{notice}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
              {loading ? "One moment…" : action}
            </button>
          </form>

          {mode !== "forgot" && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" /><span className="text-smoke text-xs">or</span><div className="flex-1 h-px bg-border" />
              </div>
              <button onClick={google} className="btn-secondary w-full flex items-center justify-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>
            </>
          )}

          <p className="text-center text-[14px] text-smoke m-0">
            {mode === "signin" && <>New here? <button type="button" onClick={() => switchMode("signup")} className="font-bold text-forest bg-transparent border-none cursor-pointer min-h-[44px] text-[14px]">Create an account</button></>}
            {mode !== "signin" && <button type="button" onClick={() => switchMode("signin")} className="font-bold text-forest bg-transparent border-none cursor-pointer min-h-[44px] text-[14px]">Back to sign in</button>}
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { createClient, createEmailLinkClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const next = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") ?? "/home" : "/home";

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await createEmailLinkClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${location.origin}/auth/confirm?next=${encodeURIComponent(next)}`, shouldCreateUser: true },
    });
    if (error) setError(error.message);
    else setSent(true);
    setLoading(false);
  }

  async function google() {
    await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <div className="bg-forest text-white px-5 pt-14 pb-8">
        <div className="max-w-sm mx-auto">
          <a href="/" className="flex items-center gap-3 mb-5 no-underline text-white">
            <div className="w-11 h-11 rounded-full bg-white text-forest flex items-center justify-center font-display font-extrabold text-base">SP</div>
            <span className="font-bold text-base">ScoutPlatform</span>
          </a>
          <h1 className="font-display font-extrabold text-[32px] leading-tight m-0">Your troop,<br />organized.</h1>
          <p className="text-[15px] mt-2 mb-0" style={{ color: "#CFE0D7" }}>RSVP, pay, track forms and advancement. No password needed.</p>
        </div>
      </div>

      <div className="flex-1 px-4 py-8 flex flex-col gap-5 max-w-sm mx-auto w-full">
        {sent ? (
          <div className="card flex flex-col gap-3 text-center py-8">
            <h2 className="font-display font-bold text-xl m-0">Check your email</h2>
            <p className="text-smoke text-[15px] m-0">
              We sent a sign-in link to <strong>{email}</strong>. Tap it on any device to continue.
            </p>
            <p className="text-smoke text-[13px] m-0">Nothing there? Check spam, or try again in a minute.</p>
            <button className="btn-ghost text-sm mt-2" onClick={() => setSent(false)}>Use a different email</button>
          </div>
        ) : (
          <>
            <form onSubmit={sendLink} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="font-bold text-sm">Email address</label>
                <input id="email" type="email" required autoFocus autoComplete="email" inputMode="email"
                  value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="input w-full" />
              </div>
              {error && <p className="text-sm m-0" style={{ color: "#5E4400" }}>{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
                {loading ? "Sending…" : "Email me a sign-in link"}
              </button>
            </form>

            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-border" />
              <span className="text-smoke text-xs">or</span>
              <div className="flex-1 h-px bg-border" />
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

            <p className="text-center text-[13px] text-smoke m-0">
              New here? Sign in first, then start a troop or join one with a code.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

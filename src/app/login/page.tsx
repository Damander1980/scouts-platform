"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const supabase = createClient();

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {/* Header */}
      <div className="bg-forest text-white px-5 pt-14 pb-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-full bg-white text-forest flex items-center justify-center font-display font-extrabold text-base">
            SP
          </div>
          <span className="font-bold text-base">ScoutPlatform</span>
        </div>
        <h1 className="font-display font-extrabold text-[32px] leading-tight">
          Your troop,<br />organized.
        </h1>
        <p className="text-mist-dark text-sm mt-2">
          RSVP, pay dues, track forms — one place for every family.
        </p>
      </div>

      {/* Form */}
      <div className="flex-1 px-4 py-8 flex flex-col gap-5 max-w-sm mx-auto w-full">
        {sent ? (
          <div className="card flex flex-col gap-3 text-center py-8">
            <div className="text-4xl">📬</div>
            <h2 className="font-display font-bold text-xl">Check your email</h2>
            <p className="text-smoke text-sm">
              We sent a sign-in link to <strong>{email}</strong>. Tap it to continue.
            </p>
            <button
              className="btn-ghost text-sm mt-2"
              onClick={() => setSent(false)}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handleMagicLink} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="font-bold text-sm">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input w-full"
                />
              </div>
              {error && (
                <p className="text-sm text-orange-dark">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full disabled:opacity-50"
              >
                {loading ? "Sending…" : "Send sign-in link"}
              </button>
            </form>

            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-border" />
              <span className="text-smoke text-xs">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <button
              onClick={async () => {
                await supabase.auth.signInWithOAuth({
                  provider: "google",
                  options: { redirectTo: `${location.origin}/auth/callback` },
                });
              }}
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <p className="text-center text-xs text-smoke">
              New troop?{" "}
              <a href="/setup" className="text-forest font-bold underline">
                Set up your troop
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

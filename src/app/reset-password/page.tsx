"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PasswordInput from "@/components/PasswordInput";

// Reached from the emailed reset link (via /auth/confirm, which signs the person in first).
export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError("Use at least 8 characters."); return; }
    setLoading(true); setError("");
    const { error } = await createClient().auth.updateUser({ password });
    if (error) { setError(error.message); setLoading(false); return; }
    window.location.href = "/home";
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5" style={{ background: "#E9E3D6" }}>
      <form onSubmit={save} className="w-full max-w-[420px] bg-white rounded-[20px] p-8 flex flex-col gap-4"
        style={{ boxShadow: "0 1px 2px rgba(16,27,45,.06), 0 14px 36px rgba(16,27,45,.12)" }}>
        <h1 className="font-display font-extrabold text-[32px] m-0">Choose a new password</h1>
        <label htmlFor="password" className="font-bold text-sm">New password</label>
        <PasswordInput id="password" required minLength={8} autoComplete="new-password" autoFocus
          value={password} onChange={(e) => setPassword(e.target.value)} className="input w-full" />
        <span className="text-[12px] text-smoke">At least 8 characters.</span>
        {error && <p role="alert" className="text-sm m-0 rounded-xl p-3" style={{ background: "#FFF6D6", color: "#5E4400" }}>{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">{loading ? "Saving…" : "Save and continue"}</button>
      </form>
    </div>
  );
}

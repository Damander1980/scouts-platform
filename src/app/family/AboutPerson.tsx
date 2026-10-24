"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { IdentityFields, saveIdentity, type Identity } from "@/components/IdentityFields";

const GENDER: Record<string, string> = { male: "Male", female: "Female" };

// Goes-by name, pronouns, registration gender and the private housing note for one family member.
export default function AboutPerson({ orgId, personId, name, youth, initial }: {
  orgId: string; personId: string; name: string; youth: boolean; initial: Identity;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const summary = [initial.nickname && `Goes by ${initial.nickname}`, initial.pronouns, initial.gender && GENDER[initial.gender]].filter(Boolean).join(" · ");

  if (!open) {
    return (
      <div className="flex items-center gap-2 text-[13px] flex-wrap">
        <span className="text-smoke">{summary || "No name, pronoun or registration details yet."}</span>
        <button className="btn-ghost text-[13px] min-h-[44px] px-0" onClick={() => setOpen(true)}>Edit about {name}</button>
      </div>
    );
  }
  return (
    <form className="rounded-xl p-3 flex flex-col gap-3" style={{ background: "#F8F5EE" }} onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setError("");
      try { await saveIdentity(supabase, orgId, personId, v); setOpen(false); router.refresh(); }
      catch (err) { setError(err instanceof Error ? err.message : String(err)); }
      setBusy(false);
    }}>
      <IdentityFields value={v} onChange={setV} youth={youth} compact />
      {error && <div className="text-[13px] font-bold" style={{ color: "#A52A1C" }}>{error}</div>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        <button type="button" className="btn-secondary" onClick={() => { setV(initial); setOpen(false); }}>Cancel</button>
      </div>
    </form>
  );
}

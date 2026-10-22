"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function PhotoConsent({ personId, name, initial }: { personId: string; name: string; initial: boolean | null }) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function set(v: boolean) {
    if (busy) return; // one change at a time, so quick taps can't land out of order
    setError(""); setBusy(true);
    const { error } = await createClient().rpc("set_photo_consent", { p_person: personId, p_consent: v });
    setBusy(false);
    if (error) setError(error.message); else setValue(v);
  }
  return (
    <div className="flex items-center gap-2 flex-wrap text-[13px]">
      <span>Photos of {name} on the public website:</span>
      <button onClick={() => set(true)} className="px-2.5 py-1 rounded-full border cursor-pointer font-sans font-bold"
        style={{ background: value === true ? "#12355F" : "white", color: value === true ? "white" : "#4B5568", borderColor: "#DDD6C5" }}>Allowed</button>
      <button onClick={() => set(false)} className="px-2.5 py-1 rounded-full border cursor-pointer font-sans font-bold"
        style={{ background: value === false ? "#4B5568" : "white", color: value === false ? "white" : "#4B5568", borderColor: "#DDD6C5" }}>Members only</button>
      {value === null && <span className="text-smoke">(not set: members only)</span>}
      {error && <span style={{ color: "#A52A1C" }}>{error}</span>}
    </div>
  );
}

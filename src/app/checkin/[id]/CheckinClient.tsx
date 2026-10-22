"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function CheckinClient({ eventId, code, title, family }: { eventId: string; code: string; title: string; family: { id: string; name: string }[] }) {
  const supabase = createClient();
  const [chosen, setChosen] = useState(family.map((f) => f.id));
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true); setError("");
    const { error } = await supabase.rpc("self_check_in", { p_event: eventId, p_code: code, p_people: chosen });
    if (error) setError(error.message); else setDone(true);
    setBusy(false);
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <div className="bg-forest text-white px-5 pt-12 pb-7">
        <div className="max-w-md mx-auto">
          <div className="eyebrow" style={{ color: "#AEB9C9" }}>Check in</div>
          <h1 className="font-display font-extrabold text-[28px] m-0 mt-1">{title}</h1>
        </div>
      </div>
      <div className="max-w-md mx-auto w-full px-4 py-6 flex flex-col gap-4">
        {done ? (
          <div className="card text-center py-8"><div className="font-display font-bold text-[24px]">You&apos;re checked in</div><p className="text-smoke m-0">A leader will confirm it.</p></div>
        ) : family.length === 0 ? (
          <div className="card">Nobody in your family is a member of this unit.</div>
        ) : (
          <>
            <div className="card flex flex-col gap-2">
              <div className="font-bold">Who&apos;s here?</div>
              {family.map((f) => (
                <label key={f.id} className="flex items-center gap-3 text-[17px] py-1.5">
                  <input type="checkbox" className="w-6 h-6" checked={chosen.includes(f.id)}
                    onChange={(e) => setChosen(e.target.checked ? [...chosen, f.id] : chosen.filter((x) => x !== f.id))} />
                  {f.name}
                </label>
              ))}
            </div>
            {error && <div className="card font-bold" style={{ color: "#A52A1C" }}>{error}</div>}
            <button className="btn-primary" disabled={busy || !chosen.length} onClick={go}>{busy ? "Checking in…" : "Check in"}</button>
          </>
        )}
      </div>
    </div>
  );
}

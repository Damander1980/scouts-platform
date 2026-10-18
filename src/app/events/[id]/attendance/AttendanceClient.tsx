"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ErrorBox } from "@/components/ui";

type P = { id: string; name: string; type: string; rsvp: string | null; patrol: string };

export default function AttendanceClient({ orgId, eventId, people, initial }: {
  orgId: string; eventId: string; people: P[]; initial: Record<string, boolean>;
}) {
  const supabase = createClient();
  const [present, setPresent] = useState<Record<string, boolean>>(initial);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  async function mark(ids: string[], value: boolean | null) {
    setError("");
    const prev = { ...present };
    const next = { ...present };
    ids.forEach((id) => { if (value === null) delete next[id]; else next[id] = value; });
    setPresent(next);
    const res = value === null
      ? await supabase.from("attendance").delete().eq("event_id", eventId).in("person_id", ids)
      : await supabase.from("attendance").upsert(ids.map((pid) => ({ org_id: orgId, event_id: eventId, person_id: pid, present: value, marked_at: new Date().toISOString() })), { onConflict: "event_id,person_id" });
    if (res.error) { setPresent(prev); setError(res.error.message); }
  }

  const goingIds = people.filter((p) => p.rsvp === "going").map((p) => p.id);
  const shown = people.filter((p) => !filter || p.name.toLowerCase().includes(filter.toLowerCase()) || p.patrol.toLowerCase().includes(filter.toLowerCase()));
  const count = Object.values(present).filter(Boolean).length;

  return (
    <div className="flex flex-col gap-3">
      <ErrorBox>{error}</ErrorBox>
      <div className="flex gap-2 flex-wrap items-center">
        <span className="font-display font-bold text-[20px]">{count} present</span>
        {goingIds.length > 0 && <button className="btn-secondary" onClick={() => mark(goingIds, true)}>Mark all {goingIds.length} who RSVP&apos;d</button>}
        <input className="input flex-1 min-w-[160px]" placeholder="Find name or patrol" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {shown.map((p) => {
          const v = present[p.id];
          return (
            <div key={p.id} className="card flex items-center gap-3 py-3" style={{ borderColor: v ? "#1F5F4A" : undefined, background: v ? "#EAF0ED" : undefined }}>
              <button onClick={() => mark([p.id], v ? null : true)} aria-pressed={!!v}
                className="w-12 h-12 rounded-xl border-2 flex items-center justify-center cursor-pointer flex-none"
                style={{ borderColor: v ? "#1F5F4A" : "#B9C7C0", background: v ? "#1F5F4A" : "white" }}>
                {v && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
              </button>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[16px] truncate">{p.name}</div>
                <div className="text-[12px] text-smoke">
                  {p.type === "adult" ? "Adult" : p.patrol || "No patrol"} · {p.rsvp === "going" ? "RSVP'd yes" : p.rsvp === "not_going" ? "RSVP'd no" : "No RSVP"}
                </div>
              </div>
              {v === false ? <span className="text-[12px] font-bold" style={{ color: "#A52A1C" }}>Absent</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

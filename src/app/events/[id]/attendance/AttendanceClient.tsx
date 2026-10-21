"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";
import { Chip, ErrorBox } from "@/components/ui";

type P = { id: string; name: string; type: string; rsvp: string | null; patrol: string };
type Mark = { present: boolean; method?: string; confirmed?: boolean };
type Op = { pid: string; value: boolean | null; at: string };

// Attendance must work at a campsite with no signal: every tap is saved on the phone first,
// then synced. Pending changes survive closing the app.
export default function AttendanceClient({ orgId, eventId, people, initial, checkinCode }: {
  orgId: string; eventId: string; people: P[]; initial: Record<string, Mark>; checkinCode: string;
}) {
  const supabase = createClient();
  const key = `att-queue-${eventId}`;
  const [marks, setMarks] = useState<Record<string, Mark>>(initial);
  const [queue, setQueue] = useState<Op[]>([]);
  const [online, setOnline] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [qr, setQr] = useState("");
  const [showQr, setShowQr] = useState(false);

  const readQueue = useCallback((): Op[] => { try { return JSON.parse(localStorage.getItem(key) ?? "[]"); } catch { return []; } }, [key]);
  const writeQueue = useCallback((q: Op[]) => { try { localStorage.setItem(key, JSON.stringify(q)); } catch { /* storage unavailable */ } setQueue(q); }, [key]);

  const flush = useCallback(async () => {
    const q = readQueue();
    if (!q.length || !navigator.onLine) return;
    const latest = new Map<string, Op>();
    q.forEach((o) => latest.set(o.pid, o));
    const toSet = [...latest.values()].filter((o) => o.value !== null);
    const toClear = [...latest.values()].filter((o) => o.value === null).map((o) => o.pid);
    const r1 = toSet.length ? await supabase.from("attendance").upsert(toSet.map((o) => ({
      org_id: orgId, event_id: eventId, person_id: o.pid, present: o.value, method: "leader", confirmed: true, marked_at: o.at,
    })), { onConflict: "event_id,person_id" }) : { error: null };
    const r2 = toClear.length ? await supabase.from("attendance").delete().eq("event_id", eventId).in("person_id", toClear) : { error: null };
    if (r1.error || r2.error) { setError((r1.error || r2.error)!.message); return; }
    writeQueue([]);
  }, [eventId, orgId, readQueue, supabase, writeQueue]);

  useEffect(() => {
    const pending = readQueue();
    if (pending.length) {
      setQueue(pending);
      setMarks((m) => { const n = { ...m }; pending.forEach((o) => { if (o.value === null) delete n[o.pid]; else n[o.pid] = { present: o.value, method: "leader", confirmed: true }; }); return n; });
    }
    const up = () => { setOnline(true); flush(); };
    const down = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    flush();
    const t = setInterval(flush, 15000);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); clearInterval(t); };
  }, [flush, readQueue]);

  useEffect(() => {
    QRCode.toDataURL(`${window.location.origin}/checkin/${eventId}?c=${checkinCode}`, { width: 480, margin: 1 }).then(setQr).catch(() => {});
  }, [eventId, checkinCode]);

  function mark(ids: string[], value: boolean | null) {
    setError("");
    const at = new Date().toISOString();
    setMarks((m) => { const n = { ...m }; ids.forEach((id) => { if (value === null) delete n[id]; else n[id] = { present: value, method: "leader", confirmed: true }; }); return n; });
    writeQueue([...readQueue(), ...ids.map((pid) => ({ pid, value, at }))]);
    flush();
  }

  const goingIds = people.filter((p) => p.rsvp === "going" && !marks[p.id]).map((p) => p.id);
  const selfChecked = people.filter((p) => marks[p.id]?.method === "qr" && !marks[p.id]?.confirmed);
  const shown = people.filter((p) => !filter || p.name.toLowerCase().includes(filter.toLowerCase()) || p.patrol.toLowerCase().includes(filter.toLowerCase()));
  const count = Object.values(marks).filter((m) => m.present).length;
  const youthPresent = people.filter((p) => p.type === "youth" && marks[p.id]?.present).length;
  const adultsPresent = people.filter((p) => p.type === "adult" && marks[p.id]?.present).length;

  return (
    <div className="flex flex-col gap-3">
      <ErrorBox>{error}</ErrorBox>
      <div className="sticky top-14 z-20 bg-canvas py-2 flex gap-2 flex-wrap items-center">
        <span className="font-display font-bold text-[22px]">{count} here</span>
        <Chip>{youthPresent} youth · {adultsPresent} adults</Chip>
        {!online && <Chip tone="orange">Offline: saving on this phone</Chip>}
        {queue.length > 0 && online && <Chip tone="orange">Syncing {queue.length}…</Chip>}
        {queue.length === 0 && online && <Chip tone="green">All saved</Chip>}
        {youthPresent > 0 && adultsPresent < 2 && <Chip tone="red">Two-deep: fewer than 2 adults marked</Chip>}
      </div>

      <div className="flex gap-2 flex-wrap">
        {goingIds.length > 0 && <button className="btn-secondary" onClick={() => mark(goingIds, true)}>Mark {goingIds.length} who RSVP&apos;d yes</button>}
        {selfChecked.length > 0 && <button className="btn-secondary" onClick={() => mark(selfChecked.map((p) => p.id), true)}>Confirm {selfChecked.length} self check-ins</button>}
        <button className="btn-ghost" onClick={() => setShowQr(!showQr)}>{showQr ? "Hide QR" : "Show check-in QR"}</button>
        <input className="input flex-1 min-w-[160px]" placeholder="Find name or patrol" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>

      {showQr && qr && (
        <div className="card flex flex-col items-center gap-2 text-center">
          <img src={qr} alt="Check-in QR code" className="w-64 h-64" />
          <div className="font-bold">Families scan this to check themselves in.</div>
          <div className="text-[13px] text-smoke">Self check-ins show below until you confirm them.</div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-2">
        {shown.map((p) => {
          const m = marks[p.id];
          const v = m?.present;
          return (
            <div key={p.id} className="card flex items-center gap-3 py-3"
              style={{ borderColor: v ? "#12355F" : undefined, background: v ? "#EEE8D9" : undefined }}>
              <button onClick={() => mark([p.id], v ? null : true)} aria-pressed={!!v} aria-label={`${p.name} ${v ? "present" : "not marked"}`}
                className="w-14 h-14 rounded-xl border-2 flex items-center justify-center cursor-pointer flex-none"
                style={{ borderColor: v ? "#12355F" : "#B9C7C0", background: v ? "#12355F" : "white" }}>
                {v && <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
              </button>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[16px] truncate">{p.name}</div>
                <div className="text-[12px] text-smoke">
                  {p.type === "adult" ? "Adult" : p.patrol || "No patrol"} · {p.rsvp === "going" ? "RSVP yes" : p.rsvp === "not_going" ? "RSVP no" : "No RSVP"}
                </div>
              </div>
              {m?.method === "qr" && !m.confirmed && <Chip tone="orange">Self check-in</Chip>}
              {!v && <button className="btn-ghost text-[13px]" onClick={() => mark([p.id], false)}>Absent</button>}
              {v === false && <Chip tone="red">Absent</Chip>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

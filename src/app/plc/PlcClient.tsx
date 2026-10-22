"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Chip, ErrorBox, Field, fmtDate, isoDay } from "@/components/ui";

export type Meeting = { id: string; meeting_date: string; agenda: string | null; notes: string | null };
export type Action = { id: string; text: string; owner_id: string | null; due_date: string | null; done_at: string | null };

export default function PlcClient({ orgId, myId, meetings, actions: initialActions, people }: {
  orgId: string; myId: string; meetings: Meeting[]; actions: Action[]; people: { id: string; name: string }[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [actions, setActions] = useState(initialActions);
  const [error, setError] = useState("");
  const [newMeeting, setNewMeeting] = useState({ date: isoDay(), agenda: "" });
  const [newAction, setNewAction] = useState({ text: "", owner: "", due: "" });
  const nameOf = Object.fromEntries(people.map((p) => [p.id, p.name]));
  const open = actions.filter((a) => !a.done_at);
  const done = actions.filter((a) => a.done_at).slice(0, 10);

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setError("");
    const { error } = await fn();
    if (error) setError(error.message); else router.refresh();
    return !error;
  }

  async function toggle(a: Action) {
    const done_at = a.done_at ? null : new Date().toISOString();
    const { error } = await supabase.from("plc_actions").update({ done_at }).eq("id", a.id);
    if (error) { setError(error.message); return; }
    setActions((xs) => xs.map((x) => (x.id === a.id ? { ...x, done_at } : x)));
  }

  return (
    <div className="flex flex-col gap-5">
      <ErrorBox>{error}</ErrorBox>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
        <section className="flex flex-col gap-4 min-w-0">
          <form className="card flex flex-col gap-3" onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => supabase.from("plc_meetings").insert({ org_id: orgId, meeting_date: newMeeting.date, agenda: newMeeting.agenda || null, created_by: myId })))
              setNewMeeting({ ...newMeeting, agenda: "" });
          }}>
            <div className="font-display font-extrabold text-[20px]">Plan a meeting</div>
            <div className="grid sm:grid-cols-[180px_1fr] gap-3">
              <Field label="Date"><input className="input" type="date" value={newMeeting.date} onChange={(e) => setNewMeeting({ ...newMeeting, date: e.target.value })} required /></Field>
              <Field label="Agenda"><textarea className="input py-3 min-h-[90px]" value={newMeeting.agenda} onChange={(e) => setNewMeeting({ ...newMeeting, agenda: e.target.value })} placeholder={"Review last campout\nPlan next month's meetings\nPatrol reports"} /></Field>
            </div>
            <button className="btn-primary self-start">Add meeting</button>
          </form>

          {meetings.length === 0 && <div className="card text-smoke text-center py-6">No meetings yet.</div>}
          {meetings.map((m) => (
            <div key={m.id} className="card flex flex-col gap-3">
              <div className="font-display font-extrabold text-[19px]">{fmtDate(m.meeting_date + "T12:00:00", { weekday: "long", month: "long", day: "numeric" })}</div>
              <div className="grid md:grid-cols-2 gap-3">
                <Field label="Agenda"><textarea className="input py-3 min-h-[110px]" defaultValue={m.agenda ?? ""}
                  onBlur={(e) => e.target.value !== (m.agenda ?? "") && run(() => supabase.from("plc_meetings").update({ agenda: e.target.value || null }).eq("id", m.id))} /></Field>
                <Field label="Notes and decisions"><textarea className="input py-3 min-h-[110px]" defaultValue={m.notes ?? ""}
                  onBlur={(e) => e.target.value !== (m.notes ?? "") && run(() => supabase.from("plc_meetings").update({ notes: e.target.value || null }).eq("id", m.id))} /></Field>
              </div>
            </div>
          ))}
        </section>

        <aside className="card flex flex-col gap-3 lg:sticky lg:top-24">
          <div className="flex items-center justify-between">
            <span className="font-display font-extrabold text-[20px]">Action items</span>
            <Chip tone={open.length ? "orange" : "green"}>{open.length} open</Chip>
          </div>
          <form className="flex flex-col gap-2" onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => supabase.from("plc_actions").insert({ org_id: orgId, meeting_id: meetings[0]?.id ?? null, text: newAction.text, owner_id: newAction.owner || null, due_date: newAction.due || null, created_by: myId })))
              setNewAction({ text: "", owner: "", due: "" });
          }}>
            <input className="input" aria-label="Action item" placeholder="Reserve campsite for March" value={newAction.text} onChange={(e) => setNewAction({ ...newAction, text: e.target.value })} required />
            <div className="grid grid-cols-2 gap-2">
              <select className="input" aria-label="Who" value={newAction.owner} onChange={(e) => setNewAction({ ...newAction, owner: e.target.value })}>
                <option value="">Who?</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input className="input" type="date" aria-label="Due" value={newAction.due} onChange={(e) => setNewAction({ ...newAction, due: e.target.value })} />
            </div>
            <button className="btn-secondary">Add</button>
          </form>
          <div className="flex flex-col">
            {[...open, ...done].map((a) => (
              <label key={a.id} className="flex items-start gap-3 py-2.5 border-t border-[#EAE4D6] text-[14px] cursor-pointer" style={{ opacity: a.done_at ? 0.55 : 1 }}>
                <input type="checkbox" className="w-5 h-5 mt-0.5 flex-none" checked={!!a.done_at} onChange={() => toggle(a)} />
                <span className="flex-1">
                  <span className={a.done_at ? "line-through" : "font-bold"}>{a.text}</span>
                  <span className="block text-[12px] text-smoke">{[a.owner_id ? nameOf[a.owner_id] : null, a.due_date ? `due ${fmtDate(a.due_date + "T12:00:00", { month: "short", day: "numeric" })}` : null].filter(Boolean).join(" · ")}</span>
                </span>
              </label>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

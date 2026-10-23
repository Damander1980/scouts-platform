"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ErrorBox, Field, fmtDate } from "@/components/ui";

export default function ComposeClient({ orgId, isLeader, weekBroadcasts = 0, canMoney = false, patrols, events, members, initialAudience, initialRef }: {
  orgId: string; isLeader: boolean; weekBroadcasts?: number; canMoney?: boolean;
  patrols: { id: string; name: string }[];
  events: { id: string; title: string; start_at: string }[];
  members: { id: string; name: string; type: string }[];
  initialAudience: string; initialRef: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [audience, setAudience] = useState(initialAudience);
  const [who, setWho] = useState("");
  const [ref, setRef] = useState(initialRef || patrols[0]?.id || events[0]?.id || "");
  const [people, setPeople] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const options = [
    ...(isLeader ? [["troop", "Everyone active in the unit"], ["scouts", "All Scouts (parents and leaders get a copy)"], ["parents", "All parents and guardians"], ["adults", "All adults"], ["event", "Everyone going to an event"], ["nonresponders", "Families who haven't replied to an event"], ["people", "Pick people"]] : []),
    ...(isLeader || canMoney ? [["owing", "Families who owe money (parents only)"]] : []),
    ...(patrols.length ? [["patrol", "A patrol"]] : []),
    ["leaders", "My leaders"],
  ];

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const needsRef = ["patrol", "event", "nonresponders"].includes(audience);
    const { data, error } = await supabase.rpc("send_message", {
      p_org: orgId, p_subject: subject || null, p_body: body, p_audience: audience,
      p_ref: needsRef ? ref : null, p_person_ids: audience === "people" ? people : null,
    });
    if (error) { setError(error.message); setBusy(false); return; }
    fetch("/api/notify/message", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: data }) }).catch(() => {});
    router.push(`/messages/${data}`);
    router.refresh();
  }

  return (
    <form onSubmit={send} className="card flex flex-col gap-4 max-w-2xl">
      <ErrorBox>{error}</ErrorBox>
      <Field label="To">
        <select className="input" value={audience} onChange={(e) => {
          setAudience(e.target.value);
          if (e.target.value === "patrol") setRef(patrols[0]?.id ?? "");
          if (["event", "nonresponders"].includes(e.target.value)) setRef(events[0]?.id ?? "");
        }}>
          {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      {audience === "patrol" && (
        <Field label="Patrol">
          <select className="input" value={ref} onChange={(e) => setRef(e.target.value)}>
            {patrols.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
      )}
      {["event", "nonresponders"].includes(audience) && (
        <Field label="Event">
          <select className="input" value={ref} onChange={(e) => setRef(e.target.value)}>
            {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title} · {fmtDate(ev.start_at, { month: "short", day: "numeric", year: "numeric" })}</option>)}
          </select>
        </Field>
      )}
      {audience === "people" && (
        <div className="flex flex-col gap-2">
          <input className="input" aria-label="Find people" placeholder={`Find people (${people.length} chosen)`} value={who} onChange={(e) => setWho(e.target.value)} />
        <div className="rounded-xl max-h-64 overflow-y-auto flex flex-col px-3" style={{ background: "#F8F5EE" }}>
          {members.filter((m) => !who || m.name.toLowerCase().includes(who.toLowerCase()) || people.includes(m.id)).map((m) => (
            <label key={m.id} className="flex items-center gap-3 py-1.5 text-[15px]">
              <input type="checkbox" className="w-5 h-5" checked={people.includes(m.id)}
                onChange={(e) => setPeople(e.target.checked ? [...people, m.id] : people.filter((x) => x !== m.id))} />
              {m.name} {m.type === "youth" && <span className="text-[12px] text-smoke">(parents and leaders will be copied)</span>}
            </label>
          ))}
        </div>
        </div>
      )}
      {isLeader && ["troop", "scouts", "parents", "adults", "nonresponders", "event"].includes(audience) && weekBroadcasts > 0 && (
        <p className="text-[13px] m-0 rounded-xl px-3 py-2" style={weekBroadcasts >= 3 ? { background: "#FFF6D6", color: "#5E4400", fontWeight: 700 } : { background: "#F8F5EE", color: "#4B5568" }}>
          {weekBroadcasts} group message{weekBroadcasts === 1 ? " has" : "s have"} gone out in the last 7 days.{weekBroadcasts >= 3 ? " Families tune out when there are too many; could this go in the weekly digest instead?" : ""}
        </p>
      )}
      <Field label="Subject (optional)"><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
      <Field label="Message"><textarea className="input py-3 min-h-[160px]" value={body} onChange={(e) => setBody(e.target.value)} required /></Field>
      <p className="text-[13px] text-smoke m-0">
        {isLeader
          ? "Sent by email to every adult with an email on file (Scouts are reached through their parents), and saved in the app. Families can reply-all from the email."
          : "Delivered inside the app and saved. Your leaders get an email that a message is waiting."}
      </p>
      <button className="btn-primary self-start px-10" disabled={busy || !body.trim() || (audience === "people" && !people.length)}>{busy ? "Sending…" : "Send"}</button>
    </form>
  );
}

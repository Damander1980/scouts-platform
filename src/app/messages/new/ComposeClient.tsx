"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ErrorBox, Field } from "@/components/ui";

export default function ComposeClient({ orgId, isLeader, patrols, events, members, initialAudience, initialRef }: {
  orgId: string; isLeader: boolean;
  patrols: { id: string; name: string }[];
  events: { id: string; title: string; start_at: string }[];
  members: { id: string; name: string; type: string }[];
  initialAudience: string; initialRef: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [audience, setAudience] = useState(initialAudience);
  const [ref, setRef] = useState(initialRef || patrols[0]?.id || events[0]?.id || "");
  const [people, setPeople] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const options = [
    ...(isLeader ? [["troop", "Whole unit"], ["event", "Everyone going to an event"], ["nonresponders", "Families who haven't replied to an event"], ["people", "Pick people"]] : []),
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
    <form onSubmit={send} className="flex flex-col gap-4 max-w-xl">
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
            {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title} · {new Date(ev.start_at).toLocaleDateString()}</option>)}
          </select>
        </Field>
      )}
      {audience === "people" && (
        <div className="card max-h-64 overflow-y-auto flex flex-col">
          {members.map((m) => (
            <label key={m.id} className="flex items-center gap-3 py-1.5 text-[15px]">
              <input type="checkbox" className="w-5 h-5" checked={people.includes(m.id)}
                onChange={(e) => setPeople(e.target.checked ? [...people, m.id] : people.filter((x) => x !== m.id))} />
              {m.name} {m.type === "youth" && <span className="text-[12px] text-smoke">(parents and leaders will be copied)</span>}
            </label>
          ))}
        </div>
      )}
      <Field label="Subject (optional)"><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
      <Field label="Message"><textarea className="input py-3 min-h-[160px]" value={body} onChange={(e) => setBody(e.target.value)} required /></Field>
      <p className="text-[13px] text-smoke m-0">
        Email and text alerts only say a message is waiting, with a link. The message itself stays in the app.
      </p>
      <button className="btn-primary" disabled={busy || !body.trim() || (audience === "people" && !people.length)}>{busy ? "Sending…" : "Send"}</button>
    </form>
  );
}

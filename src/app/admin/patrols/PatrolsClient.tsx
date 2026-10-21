"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Chip, ErrorBox, Field } from "@/components/ui";

type Patrol = { id: string; name: string; kind: string; active: boolean };
type PM = { id: string; patrol_id: string; person_id: string; role: string; start_date: string };
type Person = { id: string; name: string; type: string };
type Position = { id: string; person_id: string; title: string; start_date: string; end_date: string | null };

// Positions of responsibility that count toward Star, Life and Eagle (Scouts BSA rank requirements).
const POR = [
  "Senior Patrol Leader", "Assistant Senior Patrol Leader", "Patrol Leader", "Troop Guide", "Order of the Arrow Troop Representative",
  "Den Chief", "Scribe", "Librarian", "Historian", "Quartermaster", "Bugler", "Junior Assistant Scoutmaster",
  "Chaplain Aide", "Instructor", "Webmaster", "Outdoor Ethics Guide", "Assistant Patrol Leader",
];
const ROLE_LABEL: Record<string, string> = {
  member: "Member", patrol_leader: "Patrol Leader", assistant_patrol_leader: "Asst. Patrol Leader",
  troop_guide: "Troop Guide", adult_advisor: "Adult advisor", den_leader: "Den Leader", den_chief: "Den Chief",
};

const months = (a: string, b: string | null) => {
  const s = new Date(a), e = b ? new Date(b) : new Date();
  return Math.max(0, (e.getFullYear() - s.getFullYear()) * 12 + e.getMonth() - s.getMonth() - (e.getDate() < s.getDate() ? 1 : 0));
};

export default function PatrolsClient({ orgId, unitType, canEdit, patrols, memberships, people, positions }: {
  orgId: string; unitType: string; canEdit: boolean; patrols: Patrol[]; memberships: PM[]; people: Person[]; positions: Position[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState(unitType === "cubs" ? "den" : "patrol");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState({ person: "", title: POR[0], start: new Date().toISOString().slice(0, 10) });
  const groupWord = unitType === "cubs" ? "Den" : "Patrol";

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await fn(); router.refresh(); } catch (e: any) { setError(e.message); }
    setBusy(false);
  };

  const patrolOf = (pid: string) => memberships.find((m) => m.person_id === pid);
  const youth = people.filter((p) => p.type === "youth");
  const unassigned = youth.filter((p) => !patrolOf(p.id));
  const nameOf = Object.fromEntries(people.map((p) => [p.id, p.name]));

  const assign = (personId: string, patrolId: string) => run(async () => {
    const cur = patrolOf(personId);
    const today = new Date().toISOString().slice(0, 10);
    if (cur) {
      if (cur.patrol_id === patrolId) return;
      const { error } = await supabase.from("patrol_members").update({ end_date: today }).eq("id", cur.id);
      if (error) throw error;
    }
    if (patrolId) {
      const { error } = await supabase.from("patrol_members").insert({ org_id: orgId, patrol_id: patrolId, person_id: personId, role: "member", start_date: today });
      if (error) throw error;
    }
  });

  const setRole = (pm: PM, role: string) => run(async () => {
    const { error } = await supabase.from("patrol_members").update({ role }).eq("id", pm.id);
    if (error) throw error;
    const title = role === "patrol_leader" ? "Patrol Leader" : role === "assistant_patrol_leader" ? "Assistant Patrol Leader" : null;
    if (title) await supabase.from("leadership_positions").insert({ org_id: orgId, person_id: pm.person_id, title, start_date: new Date().toISOString().slice(0, 10) });
  });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display font-extrabold text-[32px] m-0">{groupWord}s & positions</h1>
        <a href="/plc" className="text-[14px] font-bold text-forest">Patrol Leaders&apos; Council meetings and action items →</a>
        <p className="text-[14px] text-smoke m-0 mt-1">Moves keep their history. Position dates count toward rank leadership time automatically.</p>
      </div>
      <ErrorBox>{error}</ErrorBox>

      {canEdit && (
        <form className="card flex gap-2 flex-wrap items-end" onSubmit={(e) => { e.preventDefault(); run(async () => {
          const { error } = await supabase.from("patrols").insert({ org_id: orgId, name: newName.trim(), kind: newKind });
          if (error) throw error;
          setNewName("");
        }); }}>
          <Field label={`New ${groupWord.toLowerCase()} name`}><input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} required placeholder={unitType === "cubs" ? "Den 3 (Wolves)" : "Flaming Arrows"} /></Field>
          <Field label="Type">
            <select className="input" value={newKind} onChange={(e) => setNewKind(e.target.value)}>
              {unitType === "cubs" ? <option value="den">Den</option> : <><option value="patrol">Patrol</option><option value="new_scout">New-Scout patrol</option></>}
            </select>
          </Field>
          <button className="btn-primary" disabled={busy}>Add</button>
        </form>
      )}

      {unassigned.length > 0 && (
        <div className="card flex flex-col gap-2" style={{ background: "#FFF6D6", borderColor: "#F0DA8C" }}>
          <div className="font-bold text-[15px]">Not in a {groupWord.toLowerCase()} yet ({unassigned.length})</div>
          {unassigned.map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-[14px]">
              <span className="flex-1 font-bold">{p.name}</span>
              <select className="input py-1 min-h-0 h-9 text-[14px]" defaultValue="" onChange={(e) => assign(p.id, e.target.value)} disabled={busy}>
                <option value="" disabled>Assign to…</option>
                {patrols.filter((x) => x.active).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        {patrols.filter((p) => p.active).map((p) => {
          const list = memberships.filter((m) => m.patrol_id === p.id);
          return (
            <div key={p.id} className="card flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="font-display font-bold text-[19px]">{p.name}</div>
                <div className="flex gap-2 items-center">
                  {p.kind === "new_scout" && <Chip tone="orange">New Scouts</Chip>}
                  <Chip>{list.length}</Chip>
                </div>
              </div>
              {list.length === 0 && <span className="text-[14px] text-smoke">Nobody yet</span>}
              {list.map((m) => (
                <div key={m.id} className="flex items-center gap-2 text-[14px] py-1 border-b border-[#EEE8D9] last:border-0">
                  <span className="flex-1 font-bold">{nameOf[m.person_id] ?? "Member"}</span>
                  <select className="input py-0 min-h-0 h-8 text-[13px]" value={m.role} disabled={busy || !canEdit} onChange={(e) => setRole(m, e.target.value)}>
                    {Object.entries(ROLE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                  <select className="input py-0 min-h-0 h-8 text-[13px]" value={p.id} disabled={busy || !canEdit} onChange={(e) => assign(m.person_id, e.target.value)}>
                    {patrols.filter((x) => x.active).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    <option value="">Remove</option>
                  </select>
                </div>
              ))}
              {canEdit && (
                <button className="btn-ghost self-start text-[13px]" disabled={busy} onClick={() => run(async () => {
                  for (const m of list) await supabase.from("patrol_members").update({ end_date: new Date().toISOString().slice(0, 10) }).eq("id", m.id);
                  const { error } = await supabase.from("patrols").update({ active: false }).eq("id", p.id);
                  if (error) throw error;
                })}>Retire {groupWord.toLowerCase()}</button>
              )}
            </div>
          );
        })}
      </div>

      <section className="card flex flex-col gap-3">
        <div className="font-bold text-[16px]">Youth positions of responsibility</div>
        <p className="text-[13px] text-smoke m-0">Star needs 4 months, Life and Eagle need 6 months, in an approved position. Assistant Patrol Leader does not count for Star, Life or Eagle.</p>
        {canEdit && (
          <form className="grid sm:grid-cols-4 gap-2 items-end" onSubmit={(e) => { e.preventDefault(); run(async () => {
            if (!pos.person) throw new Error("Pick a Scout");
            const { error } = await supabase.from("leadership_positions").insert({
              org_id: orgId, person_id: pos.person, title: pos.title, start_date: pos.start, counts_for_rank: pos.title !== "Assistant Patrol Leader",
            });
            if (error) throw error;
          }); }}>
            <Field label="Scout">
              <select className="input" value={pos.person} onChange={(e) => setPos({ ...pos, person: e.target.value })}>
                <option value="">Choose…</option>
                {youth.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Position">
              <select className="input" value={pos.title} onChange={(e) => setPos({ ...pos, title: e.target.value })}>
                {POR.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Started"><input className="input" type="date" value={pos.start} onChange={(e) => setPos({ ...pos, start: e.target.value })} /></Field>
            <button className="btn-primary" disabled={busy}>Add position</button>
          </form>
        )}
        <div className="flex flex-col">
          {positions.length === 0 && <span className="text-[14px] text-smoke">No positions recorded yet.</span>}
          {positions.map((x) => (
            <div key={x.id} className="flex items-center gap-2 text-[14px] py-1.5 border-b border-[#EEE8D9] last:border-0 flex-wrap">
              <span className="font-bold">{nameOf[x.person_id] ?? "Scout"}</span>
              <span>{x.title}</span>
              <span className="text-smoke">{new Date(x.start_date).toLocaleDateString()} – {x.end_date ? new Date(x.end_date).toLocaleDateString() : "now"}</span>
              <Chip tone={x.end_date ? "gray" : "green"}>{months(x.start_date, x.end_date)} months</Chip>
              {!x.end_date && canEdit && (
                <button className="btn-ghost text-[13px] ml-auto" disabled={busy} onClick={() => run(async () => {
                  const { error } = await supabase.from("leadership_positions").update({ end_date: new Date().toISOString().slice(0, 10) }).eq("id", x.id);
                  if (error) throw error;
                })}>End position</button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Chip, ErrorBox, Field } from "@/components/ui";

export type Project = {
  id: string; person_id: string; title: string; beneficiary: string | null; coach_id: string | null;
  proposal_unit_leader_at: string | null; proposal_committee_at: string | null; proposal_beneficiary_at: string | null; proposal_council_at: string | null;
  work_started_at: string | null; work_finished_at: string | null; hours: number | null;
  final_report_at: string | null; application_at: string | null; board_at: string | null; board_passed: boolean | null; notes: string | null;
};
type P = { id: string; name: string };

// Workbook order. Each step is a date a leader records.
const STEPS: [keyof Project, string][] = [
  ["proposal_unit_leader_at", "Proposal: unit leader"],
  ["proposal_committee_at", "Proposal: committee"],
  ["proposal_beneficiary_at", "Proposal: beneficiary"],
  ["proposal_council_at", "Proposal: council"],
  ["work_started_at", "Work started"],
  ["work_finished_at", "Work finished"],
  ["final_report_at", "Final report signed"],
  ["application_at", "Eagle application submitted"],
  ["board_at", "Board of review"],
];

function stage(p: Project) {
  if (p.board_passed) return { label: "Eagle Scout", tone: "dark" as const };
  const next = STEPS.find(([k]) => !p[k]);
  return next ? { label: `Next: ${next[1]}`, tone: "orange" as const } : { label: "Board held", tone: "green" as const };
}

export default function EagleClient({ orgId, projects: initial, scouts, adults }: { orgId: string; projects: Project[]; scouts: P[]; adults: P[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [projects, setProjects] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [add, setAdd] = useState({ person: "", title: "", beneficiary: "" });
  const [error, setError] = useState("");
  const nameOf = Object.fromEntries([...scouts, ...adults].map((p) => [p.id, p.name]));

  async function patch(id: string, values: Partial<Project>) {
    setError("");
    const { error } = await supabase.from("eagle_projects").update({ ...values, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { setError(error.message); return; }
    setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, ...values } : p)));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const { error } = await supabase.from("eagle_projects").insert({ org_id: orgId, person_id: add.person, title: add.title, beneficiary: add.beneficiary || null });
    if (error) { setError(error.message.includes("duplicate") ? "That Scout already has a project." : error.message); return; }
    setAdding(false); setAdd({ person: "", title: "", beneficiary: "" });
    router.refresh();
  }

  const free = scouts.filter((s) => !projects.some((p) => p.person_id === s.id));

  return (
    <div className="flex flex-col gap-4">
      <ErrorBox>{error}</ErrorBox>
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setAdding(!adding)}>+ Add a project</button>
      </div>
      {adding && (
        <form onSubmit={create} className="card flex flex-col gap-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Scout">
              <select className="input" value={add.person} onChange={(e) => setAdd({ ...add, person: e.target.value })} required>
                <option value="" disabled>Choose a Scout</option>
                {free.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Beneficiary"><input className="input" value={add.beneficiary} onChange={(e) => setAdd({ ...add, beneficiary: e.target.value })} placeholder="Grace Presbyterian Church" /></Field>
          </div>
          <Field label="Project"><input className="input" value={add.title} onChange={(e) => setAdd({ ...add, title: e.target.value })} required placeholder="Build four benches for the prayer garden" /></Field>
          <div className="flex gap-2"><button className="btn-primary">Add</button><button type="button" className="btn-secondary" onClick={() => setAdding(false)}>Cancel</button></div>
        </form>
      )}

      {projects.length === 0 && !adding && <div className="card text-smoke text-center py-8">No Eagle projects yet. Add one when a Life Scout starts their proposal.</div>}

      {projects.length > 0 && (
        <div className="card p-0 overflow-hidden">
          {[...projects].sort((a, b) => (nameOf[a.person_id] ?? "").localeCompare(nameOf[b.person_id] ?? "")).map((p) => {
            const st = stage(p);
            const done = STEPS.filter(([k]) => p[k]).length;
            const isOpen = open === p.id;
            return (
              <div key={p.id} className="border-b border-[#EAE4D6] last:border-0" style={{ background: isOpen ? "#F8F5EE" : undefined }}>
                <button onClick={() => setOpen(isOpen ? null : p.id)} aria-expanded={isOpen}
                  className="w-full flex items-center gap-4 px-5 py-4 bg-transparent border-0 cursor-pointer text-left font-sans text-ink flex-wrap">
                  <div className="flex-1 min-w-[220px]">
                    <div className="font-bold text-[16px]">{nameOf[p.person_id] ?? "Scout"}</div>
                    <div className="text-[14px] text-smoke">{p.title}{p.beneficiary ? ` · for ${p.beneficiary}` : ""}</div>
                  </div>
                  <div className="w-40 h-2 rounded-full" style={{ background: "#EEE8D9" }}>
                    <div className="h-2 rounded-full" style={{ width: `${(done / STEPS.length) * 100}%`, background: "#12355F" }} />
                  </div>
                  <Chip tone={st.tone}>{st.label}</Chip>
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 flex flex-col gap-4">
                    <div className="grid sm:grid-cols-3 gap-3">
                      {STEPS.map(([k, label]) => (
                        <Field key={k} label={label}>
                          <input className="input" type="date" defaultValue={(p[k] as string | null) ?? ""} onBlur={(e) => e.target.value !== ((p[k] as string | null) ?? "") && patch(p.id, { [k]: e.target.value || null } as Partial<Project>)} />
                        </Field>
                      ))}
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3">
                      <Field label="Project coach">
                        <select className="input" value={p.coach_id ?? ""} onChange={(e) => patch(p.id, { coach_id: e.target.value || null })}>
                          <option value="">Not assigned</option>
                          {adults.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Total hours"><input className="input" inputMode="decimal" defaultValue={p.hours ?? ""} onBlur={(e) => patch(p.id, { hours: e.target.value ? Number(e.target.value) : null })} /></Field>
                      <label className="flex items-center gap-3 text-[15px] font-bold min-h-[44px] self-end">
                        <input type="checkbox" className="w-5 h-5" checked={!!p.board_passed} disabled={!p.board_at} onChange={(e) => patch(p.id, { board_passed: e.target.checked })} />
                        Passed the board of review
                      </label>
                    </div>
                    <Field label="Notes"><textarea className="input py-3 min-h-[80px]" defaultValue={p.notes ?? ""} onBlur={(e) => patch(p.id, { notes: e.target.value || null })} /></Field>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[13px] text-smoke m-0">The council keeps the official Eagle record. Record the dates here so the troop can see who needs what next.</p>
    </div>
  );
}

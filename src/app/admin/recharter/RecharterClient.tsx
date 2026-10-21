"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Chip, ErrorBox, Stat } from "@/components/ui";

export type Person = { id: string; name: string; last: string; type: string; role: string; ypt: string | null; reg: string | null };
type Rc = { id: string; items: Record<string, { done: boolean; at?: string }>; notes: string | null; due_on: string | null; submitted_at: string | null };

// Steps follow the usual council renewal flow; councils vary, so the list is a guide, not a rulebook.
const STEPS: [string, string, string][] = [
  ["roster", "Review the roster", "Drop members who left and add anyone new. Everyone renewing must be on the list below."],
  ["key3", "Confirm the Key 3", "Chartered organization representative, committee chair and unit leader."],
  ["agreement", "Chartered organization agreement", "Signed or renewed with the chartered organization."],
  ["ypt", "Every adult has current YPT", "Adults with expired Youth Protection Training cannot be renewed."],
  ["apps", "New adult applications and background checks", "Anyone new needs an application before the charter is submitted."],
  ["training", "Position-specific training", "Direct-contact leaders need their position training on record."],
  ["fees", "Collect member registration fees", "From families and adults, or from the unit budget."],
  ["unit_fee", "Unit charter fee and insurance paid", "Paid to the council with the renewal."],
  ["submit", "Submitted to the council", "Through the council's online renewal system."],
];

export default function RecharterClient({ orgId, year, canEdit, people, recharter }: { orgId: string; year: number; canEdit: boolean; people: Person[]; recharter: Rc | null }) {
  const supabase = createClient();
  const router = useRouter();
  const [items, setItems] = useState(recharter?.items ?? {});
  const [notes, setNotes] = useState(recharter?.notes ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const start = `${year}-01-01`;

  const save = async (next: Rc["items"], n = notes) => {
    setBusy(true); setError("");
    const row = { org_id: orgId, charter_year: year, items: next, notes: n || null, submitted_at: next.submit?.done ? (recharter?.submitted_at ?? new Date().toISOString()) : null };
    const { error } = await supabase.from("recharters").upsert(row, { onConflict: "org_id,charter_year" });
    if (error) setError(error.message); else { setItems(next); router.refresh(); }
    setBusy(false);
  };
  const toggle = (k: string) => save({ ...items, [k]: { done: !items[k]?.done, at: new Date().toISOString() } });

  const adults = people.filter((p) => p.type === "adult");
  const youth = people.filter((p) => p.type === "youth");
  const yptBad = adults.filter((p) => !p.ypt || p.ypt < start);
  const regDue = people.filter((p) => !p.reg || p.reg < start);
  const done = STEPS.filter(([k]) => items[k]?.done).length;

  const yptCell = (p: Person) => p.type !== "adult" ? <span className="text-smoke">n/a</span>
    : !p.ypt ? <Chip tone="red">Not entered</Chip>
    : p.ypt < start ? <Chip tone="red">Expires {p.ypt}</Chip>
    : <Chip tone="green">{p.ypt}</Chip>;
  const regCell = (p: Person) => !p.reg ? <Chip>Unknown</Chip> : p.reg < start ? <Chip tone="orange">Renew ({p.reg})</Chip> : <Chip tone="green">{p.reg}</Chip>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display font-extrabold text-[28px] m-0">Recharter {year}</h1>
          <p className="text-[14px] text-smoke m-0 mt-1">Yearly renewal checklist. Steps vary a little by council; use this as a guide.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a className="btn-secondary no-underline" href={`/admin/recharter?year=${year - 1}`}>← {year - 1}</a>
          <a className="btn-secondary no-underline" href={`/admin/recharter?year=${year + 1}`}>{year + 1} →</a>
          <a className="btn-secondary no-underline" href="/api/export/roster.csv">Roster CSV for renewal</a>
        </div>
      </div>
      <ErrorBox>{error}</ErrorBox>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Steps done" value={`${done} / ${STEPS.length}`} tone={done === STEPS.length ? "#12355F" : undefined} />
        <Stat label="Renewing" value={`${youth.length} youth, ${adults.length} adult${adults.length === 1 ? "" : "s"}`} />
        <Stat label="Adults missing YPT" value={yptBad.length} tone={yptBad.length ? "#A52A1C" : undefined} />
        <Stat label="Registrations to renew" value={regDue.length} />
      </div>

      <div className="card flex flex-col gap-1">
        <div className="font-bold text-[16px] mb-1">Checklist</div>
        {STEPS.map(([k, label, hint]) => (
          <label key={k} className="flex gap-3 items-start py-2 border-b cursor-pointer" style={{ borderColor: "#E3EAE6", minHeight: 44 }}>
            <input type="checkbox" className="mt-1 w-5 h-5" checked={!!items[k]?.done} disabled={!canEdit || busy} onChange={() => toggle(k)} />
            <span className="flex flex-col">
              <span className="font-bold text-[14px]">{label}{k === "ypt" && yptBad.length > 0 && <span style={{ color: "#A52A1C" }}> ({yptBad.length} not current)</span>}</span>
              <span className="text-[13px] text-smoke">{hint}{items[k]?.done && items[k]?.at ? ` Done ${new Date(items[k].at!).toLocaleDateString()}.` : ""}</span>
            </span>
          </label>
        ))}
        <textarea className="input mt-2" rows={3} placeholder="Notes for next year (council contact, deadlines, what went wrong)" value={notes}
          disabled={!canEdit} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (recharter?.notes ?? "") && save(items, notes)} />
      </div>

      <div className="card overflow-x-auto">
        <div className="font-bold text-[16px] mb-2">Who is renewing</div>
        <table className="w-full border-collapse text-[14px]">
          <thead><tr className="text-left text-smoke text-[12px]"><th className="py-1">Name</th><th>Role</th><th>Registration expires</th><th>YPT expires</th></tr></thead>
          <tbody>{people.map((p) => (
            <tr key={p.id} className="border-t" style={{ borderColor: "#E3EAE6" }}>
              <td className="py-1.5 font-bold">{p.name}</td><td>{p.role}</td><td>{regCell(p)}</td><td>{yptCell(p)}</td>
            </tr>
          ))}</tbody>
        </table>
        <p className="text-[12px] text-smoke mt-2 mb-0">Dates come from the roster import or the Members page. Re-import your Scoutbook roster to refresh them.</p>
      </div>
    </div>
  );
}

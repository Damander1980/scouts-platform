"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ErrorBox } from "@/components/ui";
import { checkSaved } from "@/lib/saved";

export type Row = { id: string; name: string; type: string; ypt_expires: string | null; registration_expires: string | null; swim_class: string | null; uniform_size: string | null };
const SIZES = ["", "YS", "YM", "YL", "YXL", "AS", "AM", "AL", "AXL", "A2XL", "A3XL"];

export default function BulkClient({ rows: initial, canEdit }: { rows: Row[]; canEdit: boolean }) {
  const supabase = createClient();
  const [rows, setRows] = useState(initial);
  const [show, setShow] = useState<"all" | "youth" | "adult">("all");
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function patch(id: string, values: Partial<Row>) {
    setError("");
    try { checkSaved(await supabase.from("memberships").update(values).eq("id", id).select("id")); }
    catch (e: any) { setError(e.message); return; }
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...values } : r)));
    setSaved(id); setTimeout(() => setSaved((x) => (x === id ? null : x)), 1500);
  }

  const shown = rows.filter((r) => show === "all" || r.type === show);
  return (
    <div className="flex flex-col gap-3">
      <ErrorBox>{error}</ErrorBox>
      {!canEdit && <div className="card">Only unit admins can change these.</div>}
      <div className="flex gap-2 items-center">
        <select className="input w-auto" aria-label="Show" value={show} onChange={(e) => setShow(e.target.value as typeof show)}>
          <option value="all">Everyone</option><option value="youth">Scouts</option><option value="adult">Adults</option>
        </select>
        <span className="text-[13px] text-smoke">{shown.length} people</span>
      </div>
      <div className="card p-0 overflow-x-auto">
        <table className="w-full border-collapse text-[14px] min-w-[760px]">
          <thead>
            <tr className="text-left eyebrow text-smoke" style={{ background: "#F8F5EE" }}>
              <th scope="col" className="px-4 py-3">Name</th><th scope="col" className="px-2">Swim test</th><th scope="col" className="px-2">Shirt size</th>
              <th scope="col" className="px-2">YPT expires</th><th scope="col" className="px-2">Registration expires</th><th className="px-2"><span className="sr-only">Saved</span></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-t border-[#EAE4D6]">
                <th scope="row" className="px-4 py-2 text-left font-bold whitespace-nowrap">{r.name}{r.type === "adult" && <span className="text-smoke font-normal"> · adult</span>}</th>
                <td className="px-2 py-1.5">
                  <select className="input h-10 min-h-0" aria-label={`Swim test for ${r.name}`} disabled={!canEdit} value={r.swim_class ?? ""}
                    onChange={(e) => patch(r.id, { swim_class: e.target.value || null })}>
                    <option value="">Not tested</option><option value="swimmer">Swimmer</option><option value="beginner">Beginner</option><option value="nonswimmer">Non-swimmer</option>
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <select className="input h-10 min-h-0" aria-label={`Shirt size for ${r.name}`} disabled={!canEdit} value={r.uniform_size ?? ""}
                    onChange={(e) => patch(r.id, { uniform_size: e.target.value || null })}>
                    {[...new Set([...SIZES, r.uniform_size ?? ""])].map((s) => <option key={s} value={s}>{s || "—"}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  {r.type === "adult" ? <input className="input h-10 min-h-0" type="date" aria-label={`YPT expires for ${r.name}`} disabled={!canEdit} defaultValue={r.ypt_expires ?? ""}
                    onBlur={(e) => e.target.value !== (r.ypt_expires ?? "") && patch(r.id, { ypt_expires: e.target.value || null })} /> : <span className="text-smoke">—</span>}
                </td>
                <td className="px-2 py-1.5">
                  {r.type === "adult" ? <input className="input h-10 min-h-0" type="date" aria-label={`Registration expires for ${r.name}`} disabled={!canEdit} defaultValue={r.registration_expires ?? ""}
                    onBlur={(e) => e.target.value !== (r.registration_expires ?? "") && patch(r.id, { registration_expires: e.target.value || null })} /> : <span className="text-smoke">—</span>}
                </td>
                <td className="px-2 text-[12px] font-bold text-forest w-14">{saved === r.id ? "Saved" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { parseCsv } from "@/lib/csv";
import { mapAdvancement, mapRoster } from "@/lib/importMap";
import { Chip, ErrorBox } from "@/components/ui";

type Batch = { id: string; kind: string; file_name: string | null; row_count: number; created_at: string; undone_at: string | null };

export default function ImportClient({ orgId, isAdmin, batches }: { orgId: string; isAdmin: boolean; batches: Batch[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [kind, setKind] = useState<"roster" | "advancement">("roster");
  const [file, setFile] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  async function onFile(f: File | undefined) {
    setError(""); setResult(""); setRows([]);
    if (!f) return;
    if (f.size > 5_000_000) { setError("That file is too large (5 MB max)."); return; }
    if (!/\.(csv|txt)$/i.test(f.name)) { setError("Upload a .csv file. In Excel or Google Sheets, use File > Download > CSV."); return; }
    setFile(f.name);
    const mapped = kind === "roster" ? mapRoster(parseCsv(await f.text())) : mapAdvancement(parseCsv(await f.text()));
    if (!mapped.length) { setError("We couldn't find First name and Last name columns. Check the header row."); return; }
    setRows(mapped);
  }

  async function runImport() {
    setBusy(true); setError(""); setResult("");
    try {
      if (kind === "roster") {
        const { error } = await supabase.rpc("import_roster", { p_org: orgId, p_file: file, p_rows: rows });
        if (error) throw error;
        setResult(`Imported. People already on your roster were skipped.`);
      } else {
        const { data, error } = await supabase.rpc("import_advancement", { p_org: orgId, p_file: file, p_rows: rows });
        if (error) throw error;
        const d = data as { matched: number; skipped: number };
        setResult(`Imported ${d.matched} records. ${d.skipped} couldn't be matched to a Scout or requirement and were skipped.`);
      }
      setRows([]);
      router.refresh();
    } catch (e: any) { setError(e.message); }
    setBusy(false);
  }

  const template = kind === "roster"
    ? "First name,Last name,Type,Birthdate,Role,Patrol,Family,Email\nJake,Garcia,Youth,2012-05-14,Scout,Eagles,garcia,\nTom,Garcia,Adult,,Parent,,garcia,tom@example.com\n"
    : "First name,Last name,Advancement Type,Advancement,Date Completed\nJake,Garcia,Rank,Tenderfoot,2025-03-01\nJake,Garcia,Merit Badge,First Aid,2025-06-12\nJake,Garcia,Rank Requirement,Second Class #1a,2025-04-02\n";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display font-extrabold text-[32px] m-0">Import & export</h1>
        <p className="text-[14px] text-smoke m-0 mt-1">Bring your roster and advancement over by file. Preview everything before it's saved, and undo an import any time.</p>
      </div>
      {!isAdmin && <div className="card">Only unit admins can import. You can still export below.</div>}

      <div role="tablist" className="flex gap-6 border-b-2 border-[#DDD6C5]">
        {(["roster", "advancement"] as const).map((k) => (
          <button key={k} role="tab" aria-selected={kind === k} onClick={() => { setKind(k); setRows([]); setResult(""); setError(""); }}
            className="min-h-[44px] -mb-[2px] px-0.5 bg-transparent border-0 border-b-[3px] cursor-pointer font-sans text-[15px] whitespace-nowrap"
            style={{ borderColor: kind === k ? "#F5B700" : "transparent", color: kind === k ? "#101B2D" : "#4B5568", fontWeight: kind === k ? 700 : 500 }}>
            {k === "roster" ? "Roster" : "Advancement (Scoutbook)"}
          </button>
        ))}
      </div>

      {isAdmin && (
        <div className="card flex flex-col gap-3">
          <div className="font-bold text-[16px]">{kind === "roster" ? "Upload a roster CSV" : "Upload Scoutbook advancement CSV"}</div>
          <p className="text-[13px] text-smoke m-0">
            {kind === "roster"
              ? "Works with Scoutbook roster exports and most spreadsheets. Rows with the same Family value (or last name) become one household."
              : "From Scoutbook Plus, export Scout advancement. Completed ranks, merit badges and requirements are recorded as signed off."}
          </p>
          <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} className="text-[14px]" />
          <a className="text-[13px] font-bold text-forest" download={`${kind}-template.csv`} href={`data:text/csv;charset=utf-8,${encodeURIComponent(template)}`}>Download a template</a>
        </div>
      )}

      <ErrorBox>{error}</ErrorBox>
      {result && <div className="card font-bold" style={{ background: "#EEE8D9" }}>{result}</div>}

      {rows.length > 0 && (
        <div className="card flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="font-bold text-[16px]">Preview: {rows.length} rows from {file}</div>
            <div className="flex gap-2">
              <button className="btn-primary" disabled={busy} onClick={runImport}>{busy ? "Importing…" : `Import ${rows.length} rows`}</button>
              <button className="btn-secondary" onClick={() => setRows([])}>Cancel</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead><tr>{Object.keys(rows[0]).map((h) => <th key={h} className="text-left px-2 py-1 text-smoke uppercase text-[11px]">{h}</th>)}</tr></thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-t border-[#EEE8D9]">{Object.keys(rows[0]).map((h) => <td key={h} className="px-2 py-1">{r[h]}</td>)}</tr>
                ))}
              </tbody>
            </table>
            {rows.length > 50 && <div className="text-[13px] text-smoke mt-2">…and {rows.length - 50} more</div>}
          </div>
        </div>
      )}

      <section className="card flex flex-col gap-2">
        <div className="font-bold text-[16px]">Export</div>
        <div className="flex gap-2 flex-wrap">
          <a href="/api/export/roster.csv" className="btn-secondary no-underline">Roster CSV</a>
          <a href="/api/export/advancement.csv" className="btn-secondary no-underline">Advancement CSV (Scoutbook-ready)</a>
          <a href="/api/export/ledger.csv" className="btn-secondary no-underline">Ledger CSV</a>
          <a href="/api/export/attendance.csv" className="btn-secondary no-underline">Attendance CSV</a>
          <a href="/api/export/all" className="btn-primary no-underline">Download everything</a>
        </div>
        <p className="text-[12px] text-smoke m-0">Your data is yours. Download it all any time.</p>
      </section>

      <section className="flex flex-col gap-2">
        <div className="font-bold text-[13px] tracking-widest uppercase text-smoke">Import history</div>
        {batches.length === 0 && <div className="card text-smoke">No imports yet.</div>}
        {batches.map((b) => (
          <div key={b.id} className="card flex items-center gap-3 flex-wrap">
            <span className="font-bold text-[14px]">{b.file_name ?? b.kind}</span>
            <Chip>{b.kind}</Chip>
            <span className="text-[13px] text-smoke">{b.row_count} rows · {new Date(b.created_at).toLocaleString()}</span>
            {b.undone_at ? <Chip tone="gray">Undone</Chip> : isAdmin && (
              <button className="btn-ghost ml-auto" disabled={busy} onClick={async () => {
                setBusy(true);
                const { error } = await supabase.rpc("undo_import", { p_batch: b.id });
                if (error) setError(error.message); else router.refresh();
                setBusy(false);
              }}>Undo</button>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

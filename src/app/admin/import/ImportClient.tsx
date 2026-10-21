"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { parseCsv } from "@/lib/csv";
import { Chip, ErrorBox } from "@/components/ui";

type Batch = { id: string; kind: string; file_name: string | null; row_count: number; created_at: string; undone_at: string | null };

// Header aliases cover our template, Scoutbook Plus exports and common spreadsheets.
const ROSTER_FIELDS: Record<string, string[]> = {
  first: ["first", "first name", "firstname", "given name", "scout first name"],
  last: ["last", "last name", "lastname", "surname", "family name", "scout last name"],
  type: ["type", "youth/adult", "member type", "youth or adult", "adult/youth", "member type (youth/adult)"],
  birthdate: ["birthdate", "birth date", "dob", "date of birth", "birthday"],
  role: ["role", "position", "leader position", "unit position", "positions"],
  patrol: ["patrol", "patrol name", "den", "sub unit", "subunit", "sub-unit", "sub unit name"],
  household: ["household", "family", "family id"],
  email: ["email", "e-mail", "email address", "parent email", "parent 1 email", "primary email"],
  member_id: ["member id", "bsa member id", "memberid", "bsa id", "member #", "member number"],
  ypt_expires: ["ypt expires", "ypt expiration", "ypt expiration date", "ypt exp", "youth protection expires",
    "youth protection expiration", "youth protection expiration date", "y01 expires", "safeguarding youth expires"],
};
const ADV_FIELDS: Record<string, string[]> = {
  first: ["first name", "first", "firstname"],
  last: ["last name", "last", "lastname"],
  type: ["advancement type", "type"],
  item: ["advancement", "award", "rank", "merit badge", "item"],
  date: ["date completed", "date earned", "completed", "date", "awarded date"],
};

const ROLE_MAP: Record<string, string> = {
  scoutmaster: "scoutmaster", "assistant scoutmaster": "assistant_scoutmaster", asm: "assistant_scoutmaster",
  "committee chair": "committee_chair", "committee member": "committee_member", treasurer: "treasurer",
  "advancement chair": "advancement_chair", "chartered org rep": "chartered_org_rep", "chartered organization representative": "chartered_org_rep",
  "merit badge counselor": "merit_badge_counselor", parent: "parent_guardian", "parent/guardian": "parent_guardian",
  cubmaster: "cubmaster", "den leader": "den_leader", scout: "scout", youth: "scout",
  // Scoutbook Plus position names
  "youth member": "scout", "unit advancement chair": "advancement_chair", "key 3 delegate": "committee_member",
  "unit leader": "scoutmaster", "unit committee chair": "committee_chair", "assistant scoutmaster (asm)": "assistant_scoutmaster",
};

function mapRow(row: Record<string, string>, fields: Record<string, string[]>) {
  const lower = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase().trim(), v]));
  return Object.fromEntries(Object.entries(fields).map(([f, aliases]) => [f, aliases.map((a) => lower[a]).find((v) => v !== undefined && v !== "") ?? ""]));
}

function toIsoDate(s: string) {
  if (!s) return "";
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`; }
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

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
    const parsed = parseCsv(await f.text());
    const mapped = parsed.map((r) => {
      const m = mapRow(r, kind === "roster" ? ROSTER_FIELDS : ADV_FIELDS);
      // Some exports have a single "Name" column ("Last, First" or "First Last").
      if (!m.first && !m.last) {
        const full = Object.entries(r).find(([k]) => ["name", "full name", "member name", "scout name"].includes(k.toLowerCase().trim()))?.[1]?.trim() ?? "";
        if (full.includes(",")) { const [l, f] = full.split(","); m.last = l.trim(); m.first = (f ?? "").trim(); }
        else if (full) { const parts = full.split(/\s+/); m.first = parts[0]; m.last = parts.slice(1).join(" "); }
      }
      if (m.type) m.type = /^y/i.test(m.type) ? "youth" : /^a/i.test(m.type) ? "adult" : m.type;
      return m;
    }).filter((r) => r.first && r.last);
    if (!mapped.length) { setError("We couldn't find First name and Last name columns. Check the header row."); return; }
    setRows(mapped.map((r) => kind === "roster"
      ? { ...r, household: r.household || r.email, birthdate: toIsoDate(r.birthdate), ypt_expires: toIsoDate(r.ypt_expires), role: ROLE_MAP[r.role?.toLowerCase()] ?? "", type: r.type || (ROLE_MAP[r.role?.toLowerCase()] && !["scout"].includes(ROLE_MAP[r.role?.toLowerCase()]) ? "adult" : "youth") }
      : { ...r, date: toIsoDate(r.date), ...parseAdvancement(r.item, r.type) }));
  }

  function parseAdvancement(item: string, type: string) {
    // Scoutbook lists requirements as e.g. "Tenderfoot #4a" or "Camping #9a".
    const m = item.match(/^(.*?)\s*#\s*([0-9]+[a-z]?)/i);
    if (m) return { item: m[1].trim(), requirement: m[2] };
    if (/requirement/i.test(type)) return { item, requirement: "" };
    return { item: item.replace(/\s*merit badge$/i, "").trim(), requirement: "" };
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
        <h1 className="font-display font-extrabold text-[28px] m-0">Import & export</h1>
        <p className="text-[14px] text-smoke m-0 mt-1">Bring your roster and advancement over by file. Preview everything before it's saved, and undo an import any time.</p>
      </div>
      {!isAdmin && <div className="card">Only unit admins can import. You can still export below.</div>}

      <div className="flex gap-2">
        {(["roster", "advancement"] as const).map((k) => (
          <button key={k} onClick={() => { setKind(k); setRows([]); setResult(""); setError(""); }}
            className="px-4 py-2 rounded-full text-[14px] font-bold border cursor-pointer font-sans"
            style={{ background: kind === k ? "#12355F" : "white", color: kind === k ? "white" : "#4B5568", borderColor: kind === k ? "#12355F" : "#DDD6C5" }}>
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

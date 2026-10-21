"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Chip, ErrorBox } from "@/components/ui";

type Person = { id: string; name: string; type: string; role: string; ypt: string | null; swim: string | null };
type Form = { person_id: string; type: string; exam_date: string | null; expires_at: string | null };
type Cert = { id: string; code: string; name: string };
type ScoutCert = { id: string; person_id: string; cert_id: string; status: string; earned_at: string; note: string | null };

const FORM_TYPES: [string, string][] = [["health_ab", "Health A+B"], ["health_c", "Health C"], ["permission", "Permission"]];

export default function FormsClient({ orgId, canMark, people, forms: initialForms, certs, scoutCerts: initialCerts }: {
  orgId: string; canMark: boolean; people: Person[]; forms: Form[]; certs: Cert[]; scoutCerts: ScoutCert[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [forms, setForms] = useState(initialForms);
  const [scoutCerts, setScoutCerts] = useState(initialCerts);
  const [editing, setEditing] = useState<{ pid: string; type: string } | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [view, setView] = useState<"forms" | "certs">("forms");
  const [filter, setFilter] = useState<"all" | "missing">("all");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const status = (pid: string, type: string) => {
    const f = forms.find((x) => x.person_id === pid && x.type === type);
    if (!f) return { tone: "orange" as const, label: "Needed", f };
    const exp = f.expires_at ? new Date(f.expires_at) : null;
    if (exp && exp < new Date()) return { tone: "red" as const, label: "Expired", f };
    if (exp && exp.getTime() < Date.now() + 30 * 86400000) return { tone: "orange" as const, label: `Expires ${exp.toLocaleDateString()}`, f };
    return { tone: "green" as const, label: exp ? `To ${exp.toLocaleDateString("en-US", { month: "short", year: "numeric" })}` : "On file", f };
  };

  async function mark(pid: string, type: string, received: boolean) {
    setBusy(true); setError("");
    const { error } = await supabase.rpc("mark_form", { p_org: orgId, p_person: pid, p_type: type, p_date: date, p_received: received });
    if (error) setError(error.message);
    else {
      const exp = new Date(new Date(date).getFullYear(), new Date(date).getMonth() + 13, 0).toISOString();
      setForms((fs) => [...fs.filter((f) => !(f.person_id === pid && f.type === type)), ...(received ? [{ person_id: pid, type, exam_date: date, expires_at: exp }] : [])]);
      setEditing(null);
    }
    setBusy(false);
  }

  async function setCert(pid: string, certId: string, next: "active" | "suspended" | "revoked" | null) {
    setBusy(true); setError("");
    const existing = scoutCerts.find((c) => c.person_id === pid && c.cert_id === certId);
    const res = next === null
      ? await supabase.from("scout_certifications").delete().eq("id", existing!.id)
      : existing
        ? await supabase.from("scout_certifications").update({ status: next }).eq("id", existing.id).select().single()
        : await supabase.from("scout_certifications").insert({ org_id: orgId, person_id: pid, cert_id: certId, status: next }).select().single();
    if (res.error) setError(res.error.message);
    else router.refresh();
    if (!res.error) {
      setScoutCerts((cs) => {
        const rest = cs.filter((c) => !(c.person_id === pid && c.cert_id === certId));
        return next === null ? rest : [...rest, (res.data as ScoutCert) ?? { ...existing!, status: next }];
      });
    }
    setBusy(false);
  }

  const missingAny = (p: Person) => FORM_TYPES.slice(0, 1).some(([t]) => status(p.id, t).tone !== "green");
  const shown = people.filter((p) => filter === "all" || missingAny(p));
  const leaders = people.filter((p) => p.type === "adult" && !["parent_guardian", "scout"].includes(p.role));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display font-extrabold text-[28px] m-0">Forms & safety</h1>
        <p className="text-[14px] text-smoke m-0 mt-1">
          Completed medical forms stay on paper with your designated leader. Here you only record that each part was received and when it expires.
        </p>
      </div>
      {!canMark && <div className="card">Only designated leaders can record forms. Ask a unit admin to make you one.</div>}
      <ErrorBox>{error}</ErrorBox>

      <div role="tablist" className="flex gap-6 overflow-x-auto border-b-2 border-[#DDD6C5] items-center">
        {(["forms", "certs"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} role="tab" aria-selected={view === v} className="min-h-[44px] -mb-[2px] px-0.5 bg-transparent border-0 border-b-[3px] cursor-pointer font-sans text-[15px] whitespace-nowrap"
            style={{ borderColor: view === v ? "#F5B700" : "transparent", color: view === v ? "#101B2D" : "#4B5568", fontWeight: view === v ? 700 : 500 }}>
            {v === "forms" ? "Health & permission" : "Skill cards"}
          </button>
        ))}
        {view === "forms" && (
          <label className="flex items-center gap-2 text-[14px] ml-2">
            <input type="checkbox" checked={filter === "missing"} onChange={(e) => setFilter(e.target.checked ? "missing" : "all")} /> Only show missing
          </label>
        )}
        <a href="/api/export/roster.csv" className="ml-auto btn-ghost no-underline">Printable list (CSV)</a>
      </div>

      {view === "forms" && (
        <div className="flex flex-col gap-2">
          {shown.map((p) => (
            <div key={p.id} className="card flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-[15px] flex-1 min-w-[140px]">{p.name}</span>
                {p.type === "adult" && <Chip>Adult</Chip>}
                {FORM_TYPES.map(([t, label]) => {
                  const s = status(p.id, t);
                  return (
                    <button key={t} disabled={!canMark} onClick={() => setEditing(editing?.pid === p.id && editing.type === t ? null : { pid: p.id, type: t })}
                      className="bg-transparent border-0 p-0 cursor-pointer" title={canMark ? "Update" : undefined}>
                      <Chip tone={s.tone}>{label}: {s.label}</Chip>
                    </button>
                  );
                })}
              </div>
              {editing?.pid === p.id && (
                <div className="flex gap-2 flex-wrap items-center pt-2 border-t border-[#EEE8D9]">
                  <span className="text-[14px] font-bold">{FORM_TYPES.find(([t]) => t === editing.type)?.[1]} received, dated</span>
                  <input type="date" className="input h-10 min-h-0" value={date} onChange={(e) => setDate(e.target.value)} />
                  <button className="btn-primary" disabled={busy} onClick={() => mark(p.id, editing.type, true)}>Mark received</button>
                  {status(p.id, editing.type).f && <button className="btn-ghost" disabled={busy} onClick={() => mark(p.id, editing.type, false)}>Clear</button>}
                  <span className="text-[12px] text-smoke w-full">Use the exam date for Part C. Expires at the end of the 12th month after that date.</span>
                </div>
              )}
            </div>
          ))}

          {leaders.length > 0 && (
            <div className="card flex flex-col gap-2">
              <div className="font-bold text-[15px]">Leader Youth Protection Training</div>
              <p className="text-[13px] text-smoke m-0">Update dates on the Members page. Every adult on an outing needs current YPT.</p>
              <div className="flex flex-wrap gap-1.5">
                {leaders.map((l) => (
                  <Chip key={l.id} tone={!l.ypt ? "orange" : new Date(l.ypt) < new Date() ? "red" : "green"}>
                    {l.name}: {!l.ypt ? "not recorded" : new Date(l.ypt) < new Date() ? "expired" : new Date(l.ypt).toLocaleDateString()}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {view === "certs" && (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] text-smoke m-0">Tap to grant. Tap again to suspend (a corner cut) or restore. Every change is logged.</p>
          {people.filter((p) => p.type === "youth").map((p) => (
            <div key={p.id} className="card flex items-center gap-2 flex-wrap">
              <span className="font-bold text-[15px] flex-1 min-w-[140px]">{p.name}</span>
              {certs.map((c) => {
                const sc = scoutCerts.find((x) => x.person_id === p.id && x.cert_id === c.id);
                const next = !sc ? "active" : sc.status === "active" ? "suspended" : sc.status === "suspended" ? "active" : null;
                return (
                  <button key={c.id} disabled={busy} onClick={() => setCert(p.id, c.id, next as "active" | "suspended" | null)}
                    className="bg-transparent border-0 p-0 cursor-pointer">
                    <Chip tone={!sc ? "gray" : sc.status === "active" ? "green" : "red"}>
                      {c.name}{!sc ? "" : sc.status === "active" ? " ✓" : ` (${sc.status})`}
                    </Chip>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

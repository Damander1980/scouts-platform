"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ErrorBox, Field, fmtDate, isoDay } from "@/components/ui";

export type PlanReq = { id: string; label: string; text: string; need: number };
export type Link = { label: string; url: string };
export type Module = { id: string; title: string; requirement_ids: string[]; notes: string | null; links: Link[]; sort: number };
export type Session = { id: string; module_id: string; on_date: string };
type Starter = { title: string; requirement_ids: string[]; sort: number };

const EMPTY = { title: "", reqs: [] as string[], notes: "", links: [] as Link[] };
const okUrl = (u: string) => /^https?:\/\/\S+$/i.test(u.trim());

// Reusable skill modules ("Knots", "First aid"...) set up once, edited any time, and put on meeting dates.
export default function ModuleLibrary({ orgId, reqs, modules, sessions, scoutsOnTrail, starter }: {
  orgId: string; reqs: { rank: string; items: PlanReq[] }[]; modules: Module[]; sessions: Session[]; scoutsOnTrail: number; starter: Starter[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null); // module id, or "new"
  const [f, setF] = useState(EMPTY);
  const [dateFor, setDateFor] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const all = reqs.flatMap((g) => g.items);
  const byId = Object.fromEntries(all.map((r) => [r.id, r]));
  const today = isoDay();
  const titleOf = Object.fromEntries(modules.map((m) => [m.id, m.title]));

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await fn(); } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(/skill_modules|skill_sessions/.test(msg) && /exist|schema cache/i.test(msg) ? "Skill modules need the latest database update (migration 0072)." : msg);
    }
    setBusy(false);
  };
  const check = (r: { error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); };

  const startEdit = (m?: Module) => {
    setEditing(m ? m.id : "new");
    setF(m ? { title: m.title, reqs: m.requirement_ids, notes: m.notes ?? "", links: m.links ?? [] } : EMPTY);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (!f.reqs.length) throw new Error("Pick at least one requirement.");
      const links = f.links.map((l) => ({ label: l.label.trim() || "Guide", url: l.url.trim() })).filter((l) => l.url);
      if (links.some((l) => !okUrl(l.url))) throw new Error("Links must start with https:// (copy them from your browser's address bar).");
      const row = { title: f.title.trim(), requirement_ids: f.reqs, notes: f.notes.trim() || null, links };
      check(editing === "new"
        ? await supabase.from("skill_modules").insert({ ...row, org_id: orgId, sort: modules.length }).select("id").single()
        : await supabase.from("skill_modules").update(row).eq("id", editing!).select("id").single());
      setEditing(null); router.refresh();
    });
  };

  const addStarters = () => run(async () => {
    check(await supabase.from("skill_modules").insert(starter.map((s) => ({ ...s, org_id: orgId, links: [] }))).select("id"));
    router.refresh();
  });

  const remove = (m: Module) => {
    if (!window.confirm(`Delete "${m.title}"? Its scheduled dates go too.`)) return;
    run(async () => { check(await supabase.from("skill_modules").delete().eq("id", m.id).select("id")); router.refresh(); });
  };

  const schedule = (m: Module) => run(async () => {
    const d = dateFor[m.id];
    if (!d) throw new Error("Pick a meeting date first.");
    check(await supabase.from("skill_sessions").insert({ org_id: orgId, module_id: m.id, on_date: d }).select("id").single());
    setDateFor({ ...dateFor, [m.id]: "" }); router.refresh();
  });

  const unschedule = (id: string) => run(async () => {
    check(await supabase.from("skill_sessions").delete().eq("id", id).select("id")); router.refresh();
  });

  const upcoming = sessions.filter((s) => s.on_date >= today).sort((a, b) => a.on_date.localeCompare(b.on_date));

  return (
    <section className="flex flex-col gap-4">
      <div className="card flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-bold text-[17px]">Coming up</div>
            <p className="text-[13px] text-smoke m-0">Scheduled skills show on every trail Scout&apos;s advancement page, with videos, so they can practice before the meeting.</p>
          </div>
        </div>
        {upcoming.length === 0 && <div className="text-[14px] text-smoke">Nothing scheduled. Pick a module below and give it a meeting date.</div>}
        {upcoming.map((s) => (
          <div key={s.id} className="flex items-center gap-3 border-t border-[#EAE4D6] pt-2.5 flex-wrap">
            <span className="font-bold text-[15px] w-28">{fmtDate(s.on_date + "T12:00:00", { weekday: "short", month: "short", day: "numeric" })}</span>
            <span className="flex-1 text-[15px]">{titleOf[s.module_id] ?? "Skill"}</span>
            <button className="btn-ghost text-[13px]" disabled={busy} onClick={() => unschedule(s.id)}>Remove</button>
          </div>
        ))}
      </div>

      <ErrorBox>{error}</ErrorBox>

      <div className="card flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-bold text-[17px]">Skill modules</div>
            <p className="text-[13px] text-smoke m-0">Each module is a skill your troop teaches, with the requirements it covers, what to bring, and videos or guides. Set it up once and reuse it every year.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {modules.length === 0 && starter.length > 0 && <button className="btn-primary" disabled={busy} onClick={addStarters}>Add {starter.length} starter modules</button>}
            {editing === null && <button className={modules.length ? "btn-primary" : "btn-secondary"} disabled={busy} onClick={() => startEdit()}>+ New module</button>}
          </div>
        </div>

        {editing !== null && (
          <form onSubmit={save} className="flex flex-col gap-3 rounded-xl p-4" style={{ background: "#F8F5EE" }}>
            <Field label="Module name"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Knots: square knot and two half-hitches" maxLength={80} required /></Field>
            <div className="flex flex-col gap-2">
              <div className="font-bold text-[14px]">Requirements it covers <span className="font-normal text-smoke">(how many trail Scouts still need each)</span></div>
              <div className="max-h-80 overflow-y-auto flex flex-col gap-3 bg-white rounded-xl p-3">
                {reqs.map((g) => (
                  <div key={g.rank} className="flex flex-col gap-1">
                    <div className="eyebrow text-forest">{g.rank}</div>
                    {g.items.map((r) => (
                      <label key={r.id} className="flex items-start gap-2 text-[14px] min-h-[44px] py-1">
                        <input type="checkbox" className="w-5 h-5 mt-0.5 flex-none" checked={f.reqs.includes(r.id)}
                          onChange={(e) => setF({ ...f, reqs: e.target.checked ? [...f.reqs, r.id] : f.reqs.filter((x) => x !== r.id) })} />
                        <span><b>{r.label}</b> {r.text} {r.need > 0 && <span className="text-[12px] font-bold" style={{ color: "#5E4400" }}>· {r.need}/{scoutsOnTrail} need it</span>}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <Field label="What to bring or practice (optional)"><textarea className="input" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={1000} placeholder="e.g. Bring a 6-foot rope. Watch the video first." /></Field>
            <div className="flex flex-col gap-2">
              <div className="font-bold text-[14px]">Videos and visual guides (optional)</div>
              {f.links.map((l, i) => (
                <div key={i} className="flex gap-2 flex-wrap">
                  <input className="input flex-1 min-w-[140px]" value={l.label} placeholder="Name, e.g. Square knot video" maxLength={60}
                    onChange={(e) => setF({ ...f, links: f.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                  <input className="input flex-[2] min-w-[200px]" type="url" value={l.url} placeholder="https://"
                    onChange={(e) => setF({ ...f, links: f.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
                  <button type="button" className="btn-ghost" onClick={() => setF({ ...f, links: f.links.filter((_, j) => j !== i) })}>Remove</button>
                </div>
              ))}
              {f.links.length < 10 && <button type="button" className="btn-secondary self-start" onClick={() => setF({ ...f, links: [...f.links, { label: "", url: "" }] })}>+ Add a link</button>}
              <span className="text-[12px] text-smoke">Without your own links, Scouts still get a &quot;Find a video&quot; search for each requirement.</span>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save module"}</button>
              <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </form>
        )}

        {modules.length === 0 && editing === null && <div className="text-[14px] text-smoke">No modules yet. Start with the starter set (every Trail to First Class requirement grouped by skill), then edit them to fit your troop.</div>}

        <div className="grid gap-3 md:grid-cols-2">
          {modules.map((m) => {
            const need = m.requirement_ids.reduce((s, id) => s + (byId[id]?.need ?? 0), 0);
            const next = sessions.find((s) => s.module_id === m.id && s.on_date >= today);
            return (
              <div key={m.id} className="rounded-xl p-4 flex flex-col gap-2" style={{ background: "#F8F5EE" }}>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-[16px] flex-1">{m.title}</span>
                  {need > 0 && <span className="text-[12px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#FFF6D6", color: "#5E4400" }}>{need} still needed</span>}
                </div>
                <div className="text-[13px] text-smoke">{m.requirement_ids.map((id) => byId[id]?.label).filter(Boolean).join(", ")}</div>
                {m.notes && <div className="text-[13px]">{m.notes}</div>}
                {(m.links ?? []).length > 0 && (
                  <div className="flex gap-2 flex-wrap">{m.links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="text-[13px] font-bold text-forest">{l.label} ↗</a>)}</div>
                )}
                {next && <div className="text-[13px] font-bold">Scheduled {fmtDate(next.on_date + "T12:00:00", { weekday: "short", month: "short", day: "numeric" })}</div>}
                <div className="flex gap-2 flex-wrap items-center pt-1">
                  <input type="date" className="input w-auto" aria-label={`Meeting date for ${m.title}`} value={dateFor[m.id] ?? ""} min={today}
                    onChange={(e) => setDateFor({ ...dateFor, [m.id]: e.target.value })} />
                  <button className="btn-secondary" disabled={busy || !dateFor[m.id]} onClick={() => schedule(m)}>Schedule</button>
                  <button className="btn-ghost" disabled={busy} onClick={() => startEdit(m)}>Edit</button>
                  <button className="btn-ghost" disabled={busy} onClick={() => remove(m)}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

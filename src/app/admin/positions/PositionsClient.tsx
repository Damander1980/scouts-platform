"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Chip, ErrorBox, Field, PageTitle, SectionLabel } from "@/components/ui";

export type Position = { id: string; title: string; audience: "adult" | "youth"; permissions: string[]; sort: number };
export type CatalogPerm = { key: string; label: string; description: string; adult_only: boolean; needs_ypt: boolean };
export type Person = { id: string; name: string; type: string; yptOk: boolean };

// The database enforces every rule shown here (migration 0034); this screen only explains them.
export default function PositionsClient({ orgId, isAdmin, positions, holders, catalog, people }: {
  orgId: string; isAdmin: boolean; positions: Position[]; holders: { position_id: string; person_id: string }[];
  catalog: CatalogPerm[]; people: Person[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState({ title: "", audience: "adult" as "adult" | "youth" });

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await fn(); router.refresh(); } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };
  const check = (r: { error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); };

  const perm = Object.fromEntries(catalog.map((c) => [c.key, c]));
  const personOf = Object.fromEntries(people.map((p) => [p.id, p]));
  const holdersOf = (pid: string) => holders.filter((h) => h.position_id === pid).map((h) => personOf[h.person_id]).filter(Boolean);

  const togglePerm = (p: Position, key: string) => run(async () => {
    const next = p.permissions.includes(key) ? p.permissions.filter((k) => k !== key) : [...p.permissions, key];
    check(await supabase.from("unit_positions").update({ permissions: next }).eq("id", p.id));
  });
  const assign = (p: Position, personId: string) => run(async () => {
    check(await supabase.from("position_holders").insert({ org_id: orgId, position_id: p.id, person_id: personId }));
    setAdding((a) => ({ ...a, [p.id]: "" }));
  });
  const unassign = (p: Position, personId: string) => run(async () => {
    check(await supabase.from("position_holders").delete().eq("position_id", p.id).eq("person_id", personId));
  });
  const remove = (p: Position) => {
    if (!confirm(`Delete the position "${p.title}"? Everyone holding it loses its access.`)) return;
    run(async () => { check(await supabase.from("unit_positions").delete().eq("id", p.id)); });
  };
  const create = () => run(async () => {
    check(await supabase.from("unit_positions").insert({ org_id: orgId, title: draft.title, audience: draft.audience, permissions: [] }));
    setDraft({ title: "", audience: draft.audience });
  });

  const section = (audience: "adult" | "youth") => {
    const list = positions.filter((p) => p.audience === audience);
    return (
      <section className="flex flex-col gap-2">
        <SectionLabel>{audience === "adult" ? "Adult positions" : "Scout positions"}</SectionLabel>
        {list.map((p) => {
          const who = holdersOf(p.id);
          const isOpen = open === p.id;
          const eligible = people.filter((x) => (audience === "youth" ? x.type === "youth" : x.type === "adult") && !who.some((w) => w.id === x.id));
          const needsYpt = p.permissions.some((k) => perm[k]?.needs_ypt);
          return (
            <div key={p.id} className="card flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1 min-w-0">
                  <b className="text-[16px]">{p.title}</b>
                  <div className="flex flex-wrap gap-1">
                    {p.permissions.length === 0 && <span className="text-[13px] text-smoke">Title only, no extra access</span>}
                    {p.permissions.map((k) => <Chip key={k} tone={perm[k]?.needs_ypt ? "orange" : "green"}>{perm[k]?.label ?? k}</Chip>)}
                  </div>
                </div>
                {isAdmin && <button className="btn-ghost" onClick={() => setOpen(isOpen ? null : p.id)}>{isOpen ? "Done" : "Edit"}</button>}
              </div>

              <div className="flex flex-wrap gap-1 items-center">
                {who.length === 0 && <span className="text-[13px] text-smoke">Nobody holds this yet</span>}
                {who.map((w) => (
                  <span key={w.id} className="inline-flex items-center gap-1">
                    <Chip tone={needsYpt && !w.yptOk ? "red" : "gray"}>{w.name}{needsYpt && !w.yptOk ? " (no current YPT)" : ""}</Chip>
                    {isOpen && <button className="btn-ghost" aria-label={`Remove ${w.name}`} disabled={busy} onClick={() => unassign(p, w.id)}>Remove</button>}
                  </span>
                ))}
              </div>

              {isOpen && (
                <div className="flex flex-col gap-3 border-t border-mist pt-3">
                  <Field label="Give this position to">
                    <div className="flex gap-2">
                      <select className="input" value={adding[p.id] ?? ""} onChange={(e) => setAdding((a) => ({ ...a, [p.id]: e.target.value }))}>
                        <option value="">Choose {audience === "youth" ? "a Scout" : "an adult"}</option>
                        {eligible.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                      <button className="btn-secondary" disabled={busy || !adding[p.id]} onClick={() => assign(p, adding[p.id])}>Add</button>
                    </div>
                  </Field>
                  <div className="flex flex-col gap-1">
                    <div className="text-[13px] font-bold">What this position can do</div>
                    {catalog.map((c) => {
                      const blocked = audience === "youth" && c.adult_only;
                      return (
                        <label key={c.key} className={`flex items-start gap-3 min-h-[44px] py-1 ${blocked ? "opacity-50" : ""}`}>
                          <input type="checkbox" className="w-5 h-5 mt-0.5" disabled={busy || blocked}
                            checked={p.permissions.includes(c.key)} onChange={() => togglePerm(p, c.key)} />
                          <span className="flex flex-col">
                            <span className="text-[14px] font-bold">{c.label}{c.needs_ypt ? " · needs current YPT" : ""}</span>
                            <span className="text-[13px] text-smoke">{blocked ? "Adults only. Scouts can never hold this." : c.description}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <button className="btn-ghost self-start" disabled={busy} onClick={() => remove(p)}>Delete position</button>
                </div>
              )}
            </div>
          );
        })}
      </section>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <PageTitle title="Positions & access" sub="Each position decides what its holders can see and do. A person can hold several." />
      <div className="card text-[14px] flex flex-col gap-1">
        <b>How children are protected</b>
        <span>Everyone in the unit sees names. Birthdates, phone numbers, emails and health form status are visible only to adults whose position allows it <b>and</b> who have current Youth Protection Training on file. Every look is logged.</span>
        <span>Scouts can hold real positions, such as planning events or running the gear, but the system will never give a Scout access to anyone's private details, health forms or money.</span>
        {!isAdmin && <span className="text-smoke">Only unit admins can change positions.</span>}
      </div>
      <ErrorBox>{error}</ErrorBox>
      {section("adult")}
      {section("youth")}
      {isAdmin && (
        <section className="card flex flex-col gap-3">
          <b>Add a position</b>
          <div className="flex flex-col md:flex-row gap-2">
            <input className="input flex-1" placeholder="Title, e.g. Summer Camp Coordinator" maxLength={80}
              value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            <select className="input" value={draft.audience} onChange={(e) => setDraft({ ...draft, audience: e.target.value as "adult" | "youth" })}>
              <option value="adult">For adults</option>
              <option value="youth">For Scouts</option>
            </select>
            <button className="btn-primary" disabled={busy || !draft.title.trim()} onClick={create}>Add</button>
          </div>
        </section>
      )}
    </div>
  );
}

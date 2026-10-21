"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Chip, ErrorBox, Field } from "@/components/ui";

type Item = { id: string; name: string; category: string | null; tag: string | null; condition: string; notes: string | null };
type Out = { id: string; equipment_id: string; person_id: string; out_at: string; due_at: string | null; returned_at: string | null };
type Doc = { id: string; title: string; url: string; category: string | null; visibility: string };

const CATS = ["Tents", "Cooking", "Trailer", "Tools", "Water", "First aid", "Library", "Other"];

export default function GearClient({ orgId, items, outs, people, docs }: { orgId: string; items: Item[]; outs: Out[]; people: { id: string; name: string }[]; docs: Doc[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [tab, setTab] = useState<"gear" | "docs">("gear");
  const [f, setF] = useState({ name: "", category: "Tents", tag: "" });
  const [d, setD] = useState({ title: "", url: "", category: "Forms", visibility: "members" });
  const [lending, setLending] = useState<{ id: string; person: string; due: string } | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const nameOf = Object.fromEntries(people.map((p) => [p.id, p.name]));
  const run = async (fn: () => Promise<void>) => { setBusy(true); setError(""); try { await fn(); router.refresh(); } catch (e: any) { setError(e.message); } setBusy(false); };
  const outFor = (id: string) => outs.find((o) => o.equipment_id === id);

  return (
    <div className="flex flex-col gap-5">
      <div><h1 className="font-display font-extrabold text-[32px] m-0">Gear & documents</h1>
        <p className="text-[14px] text-smoke m-0 mt-1">Who has which tent, and the unit&apos;s file cabinet.</p></div>
      <ErrorBox>{error}</ErrorBox>
      <div role="tablist" className="flex gap-6 overflow-x-auto border-b-2 border-[#DDD6C5]">
        {(["gear", "docs"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} role="tab" aria-selected={tab === t} className="min-h-[44px] -mb-[2px] px-0.5 bg-transparent border-0 border-b-[3px] cursor-pointer font-sans text-[15px] whitespace-nowrap"
            style={{ borderColor: tab === t ? "#F5B700" : "transparent", color: tab === t ? "#101B2D" : "#4B5568", fontWeight: tab === t ? 700 : 500 }}>
            {t === "gear" ? `Gear (${outs.length} out)` : "Documents"}</button>
        ))}
      </div>

      {tab === "gear" && (
        <>
          <form className="card flex gap-2 flex-wrap items-end" onSubmit={(e) => { e.preventDefault(); run(async () => {
            const { error } = await supabase.from("equipment").insert({ org_id: orgId, name: f.name, category: f.category, tag: f.tag || null }); if (error) throw error;
            setF({ ...f, name: "", tag: "" });
          }); }}>
            <Field label="Item"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required placeholder="Eureka 4-person tent" /></Field>
            <Field label="Category"><select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Tag / number"><input className="input w-28" value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })} placeholder="T-07" /></Field>
            <button className="btn-primary" disabled={busy}>Add</button>
          </form>
          <input className="input" placeholder="Find gear" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="flex flex-col gap-2">
            {items.filter((i) => !q || `${i.name} ${i.tag ?? ""} ${i.category ?? ""}`.toLowerCase().includes(q.toLowerCase())).map((i) => {
              const o = outFor(i.id);
              return (
                <div key={i.id} className="card flex flex-col gap-2" style={{ opacity: i.condition === "retired" ? 0.5 : 1 }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <b>{i.name}</b>{i.tag && <Chip>{i.tag}</Chip>}<Chip>{i.category}</Chip>
                    {i.condition === "needs_repair" && <Chip tone="orange">Needs repair</Chip>}
                    {o ? <Chip tone={o.due_at && new Date(o.due_at) < new Date() ? "red" : "orange"}>Out with {nameOf[o.person_id] ?? "member"}{o.due_at ? `, due ${new Date(o.due_at).toLocaleDateString()}` : ""}</Chip> : <Chip tone="green">In</Chip>}
                    <div className="ml-auto flex gap-2">
                      {o ? <button className="btn-secondary" disabled={busy} onClick={() => run(async () => { const { error } = await supabase.from("checkouts").update({ returned_at: new Date().toISOString() }).eq("id", o.id); if (error) throw error; })}>Returned</button>
                        : i.condition !== "retired" && <button className="btn-secondary" onClick={() => setLending({ id: i.id, person: "", due: "" })}>Lend</button>}
                      <select className="input h-10 min-h-0 text-[13px]" value={i.condition} onChange={(e) => run(async () => { const { error } = await supabase.from("equipment").update({ condition: e.target.value }).eq("id", i.id); if (error) throw error; })}>
                        <option value="good">Good</option><option value="needs_repair">Needs repair</option><option value="retired">Retired</option>
                      </select>
                    </div>
                  </div>
                  {lending?.id === i.id && (
                    <div className="flex gap-2 flex-wrap items-end">
                      <select className="input" value={lending.person} onChange={(e) => setLending({ ...lending, person: e.target.value })}><option value="">Who?</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                      <input className="input" type="date" value={lending.due} onChange={(e) => setLending({ ...lending, due: e.target.value })} />
                      <button className="btn-primary" disabled={busy || !lending.person} onClick={() => run(async () => {
                        const { error } = await supabase.from("checkouts").insert({ org_id: orgId, equipment_id: i.id, person_id: lending.person, due_at: lending.due || null }); if (error) throw error; setLending(null);
                      })}>Check out</button>
                    </div>
                  )}
                </div>
              );
            })}
            {items.length === 0 && <div className="card text-smoke">No gear yet. Add tents, stoves, the trailer, and library books.</div>}
          </div>
        </>
      )}

      {tab === "docs" && (
        <>
          <form className="card grid sm:grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); run(async () => {
            if (!/^https:\/\//.test(d.url)) throw new Error("Use a full https:// link (Google Drive, Dropbox, scouting.org, etc.)");
            const { error } = await supabase.from("documents").insert({ org_id: orgId, title: d.title, url: d.url, category: d.category, visibility: d.visibility }); if (error) throw error;
            setD({ ...d, title: "", url: "" });
          }); }}>
            <Field label="Title"><input className="input" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} required placeholder="Troop bylaws" /></Field>
            <Field label="Link"><input className="input" value={d.url} onChange={(e) => setD({ ...d, url: e.target.value })} required placeholder="https://" /></Field>
            <Field label="Category"><select className="input" value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })}>{["Forms", "Policies", "Packing lists", "Meeting notes", "Handbooks", "Other"].map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Who can see"><select className="input" value={d.visibility} onChange={(e) => setD({ ...d, visibility: e.target.value })}><option value="public">Public</option><option value="members">Members</option><option value="leaders">Leaders only</option></select></Field>
            <button className="btn-primary sm:col-span-2" disabled={busy}>Add document</button>
            <p className="text-[12px] text-smoke m-0 sm:col-span-2">Never post completed medical forms here. Blank forms only.</p>
          </form>
          {docs.map((x) => (
            <div key={x.id} className="card flex items-center gap-2 flex-wrap">
              <a href={x.url} target="_blank" rel="noopener noreferrer" className="font-bold text-forest">{x.title}</a>
              <Chip>{x.category}</Chip><Chip tone={x.visibility === "public" ? "green" : "gray"}>{x.visibility}</Chip>
              <button className="btn-ghost ml-auto" disabled={busy} onClick={() => run(async () => { const { error } = await supabase.from("documents").delete().eq("id", x.id); if (error) throw error; })}>Remove</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

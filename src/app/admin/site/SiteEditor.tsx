"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Chip, ErrorBox, Field, fmtDate, fmtStamp } from "@/components/ui";

type Person = { id: string; name: string; type: string; consent: boolean | null; role: string };
type Photo = { id: string; path: string; caption: string | null; tagged: string[]; hidden: boolean };
type Album = { id: string; title: string; taken_on: string | null; visibility: string; photos: Photo[] };
type Req = { id: string; name: string; email: string; phone: string | null; message: string; handled: boolean; created_at: string; to_person: string | null };

// Brand colors are checked for readable white text on top of them.
const COLORS = [["Forest", "#12355F"], ["Troop red", "#C8102E"], ["Navy", "#1F3A5F"], ["Scout tan", "#7A5C2E"], ["Charcoal", "#2E3A35"], ["Purple", "#4B2E83"]];
const TITLES = ["Scoutmaster", "Assistant Scoutmaster", "Committee Chair", "TFC Program", "New Scout Coordinator", "Troop Recruiter", "Treasurer", "Advancement Chair", "Cubmaster", "Den Leader"];

export default function SiteEditor({ orgId, slug, isAdmin, site: initial, settings, people, albums, requests, storageUrl }: {
  orgId: string; slug: string; isAdmin: boolean; site: Record<string, unknown>; settings: Record<string, unknown>;
  people: Person[]; albums: Album[]; requests: Req[]; storageUrl: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [site, setSite] = useState<Record<string, unknown>>(initial);
  const [tab, setTab] = useState<"page" | "photos" | "inbox">("page");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [contact, setContact] = useState({ title: TITLES[0], person: "" });
  const [album, setAlbum] = useState({ title: "", date: "", visibility: "public" });
  const [tagging, setTagging] = useState<string | null>(null);
  const s = (k: string) => (site[k] as string) ?? "";
  const contacts = (site.contacts as { title: string; person_id: string }[] | undefined) ?? [];
  const nameOf = Object.fromEntries(people.map((p) => [p.id, p]));

  const run = async (fn: () => Promise<void>, msg?: string) => {
    setBusy(true); setError(""); setOk("");
    try { await fn(); if (msg) setOk(msg); router.refresh(); } catch (e: any) { setError(e.message ?? String(e)); }
    setBusy(false);
  };

  const save = () => run(async () => {
    const { error } = await supabase.from("organizations").update({ settings: { ...settings, site } }).eq("id", orgId);
    if (error) throw error;
  }, "Saved. Your public page is updated.");

  const upload = async (file: File, prefix: string) => {
    if (file.size > 8_000_000) throw new Error("Images must be under 8 MB.");
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw new Error("Upload a JPG, PNG, WEBP or GIF image.");
    const path = `${orgId}/${prefix}-${crypto.randomUUID()}.${file.name.split(".").pop()?.toLowerCase() ?? "jpg"}`;
    const { error } = await supabase.storage.from("site").upload(path, file, { cacheControl: "31536000" });
    if (error) throw error;
    return path;
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display font-extrabold text-[32px] m-0">Website</h1>
          <p className="text-[14px] text-smoke m-0 mt-1">Your public page is at <a href={`/${slug}`} target="_blank" className="font-bold text-forest">/{slug}</a>. Families find you, read about you, and ask to join.</p>
          <a href="/admin/site/pages" className="btn-secondary no-underline inline-block mt-2">More pages (About, New families, and so on)</a>
        </div>
        <a href={`/${slug}`} target="_blank" className="btn-secondary no-underline">View page</a>
      </div>
      <ErrorBox>{error}</ErrorBox>
      {ok && <div className="card font-bold" style={{ background: "#EEE8D9" }}>{ok}</div>}
      {!isAdmin && <div className="card">Only unit admins can change the public page. You can manage photos and answer messages.</div>}

      <div role="tablist" className="flex gap-6 overflow-x-auto border-b-2 border-[#DDD6C5]">
        {([["page", "Page"], ["photos", "Photos"], ["inbox", `Messages${requests.filter((r) => !r.handled).length ? ` (${requests.filter((r) => !r.handled).length})` : ""}`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} role="tab" aria-selected={tab === k} className="min-h-[44px] -mb-[2px] px-0.5 bg-transparent border-0 border-b-[3px] cursor-pointer font-sans text-[15px] whitespace-nowrap"
            style={{ borderColor: tab === k ? "#F5B700" : "transparent", color: tab === k ? "#101B2D" : "#4B5568", fontWeight: tab === k ? 700 : 500 }}>{l}</button>
        ))}
      </div>

      {tab === "page" && (
        <div className="flex flex-col gap-4 max-w-3xl">
          <section className="card flex flex-col gap-3">
            <div className="font-bold text-[16px]">Look</div>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(([n, c]) => (
                <button key={c} onClick={() => setSite({ ...site, brand_color: c })} className="flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer bg-white font-sans text-[13px] font-bold"
                  style={{ borderColor: s("brand_color") === c ? "#101B2D" : "#DDD6C5" }}>
                  <span className="w-5 h-5 rounded-full" style={{ background: c }} />{n}
                </button>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Logo">
                <div className="flex items-center gap-2">
                  {s("logo_path") && <img src={storageUrl + s("logo_path")} alt="" className="w-12 h-12 rounded-full object-contain border" />}
                  <input type="file" accept="image/*" disabled={!isAdmin} onChange={(e) => e.target.files?.[0] && run(async () => setSite({ ...site, logo_path: await upload(e.target.files![0], "logo") }), "Logo uploaded. Save to publish.")} />
                </div>
              </Field>
              <Field label="Banner image (optional, wide)">
                <input type="file" accept="image/*" disabled={!isAdmin} onChange={(e) => e.target.files?.[0] && run(async () => setSite({ ...site, banner_path: await upload(e.target.files![0], "banner") }), "Banner uploaded. Save to publish.")} />
              </Field>
            </div>
          </section>

          <section className="card flex flex-col gap-3">
            <div className="font-bold text-[16px]">Welcome</div>
            <Field label="Headline"><input className="input" value={s("welcome_title")} onChange={(e) => setSite({ ...site, welcome_title: e.target.value })} placeholder="Welcome to Troop 999!" /></Field>
            <Field label="Welcome text"><textarea className="input py-3 min-h-[100px]" value={s("welcome_text")} onChange={(e) => setSite({ ...site, welcome_text: e.target.value })}
              placeholder="We are chartered by Grace Presbyterian Church in Plano, Texas..." /></Field>
            <Field label="Meeting day, time and place"><input className="input" value={s("meeting_info")} onChange={(e) => setSite({ ...site, meeting_info: e.target.value })} placeholder="Mondays 7:30–9:00 PM at Grace Presbyterian Church" /></Field>
            <Field label="Chartered organization"><input className="input" value={s("chartered_org")} onChange={(e) => setSite({ ...site, chartered_org: e.target.value })} /></Field>
            <Field label="Facebook page link" hint="Must start with https://www.facebook.com/"><input className="input" value={s("facebook_url")} onChange={(e) => setSite({ ...site, facebook_url: e.target.value })} /></Field>
          </section>

          <section className="card flex flex-col gap-3">
            <div className="font-bold text-[16px]">Who families can contact</div>
            <p className="text-[13px] text-smoke m-0">Only adults are listed. Visitors use a contact form; personal emails are never shown publicly.</p>
            {contacts.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-[15px]">
                <b>{c.title}:</b> {nameOf[c.person_id]?.name ?? "Removed member"}
                <button className="btn-ghost ml-auto" onClick={() => setSite({ ...site, contacts: contacts.filter((_, j) => j !== i) })}>Remove</button>
              </div>
            ))}
            <div className="flex gap-2 flex-wrap items-end">
              <Field label="Title"><select className="input" value={contact.title} onChange={(e) => setContact({ ...contact, title: e.target.value })}>{TITLES.map((t) => <option key={t}>{t}</option>)}</select></Field>
              <Field label="Person"><select className="input" value={contact.person} onChange={(e) => setContact({ ...contact, person: e.target.value })}>
                <option value="">Choose…</option>{people.filter((p) => p.type === "adult").map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select></Field>
              <button className="btn-secondary" disabled={!contact.person} onClick={() => { setSite({ ...site, contacts: [...contacts, { title: contact.title, person_id: contact.person }] }); setContact({ ...contact, person: "" }); }}>Add</button>
            </div>
          </section>

          <section className="card flex flex-col gap-3">
            <div className="font-bold text-[16px]">About your unit</div>
            <textarea className="input py-3 min-h-[180px]" value={s("about")} onChange={(e) => setSite({ ...site, about: e.target.value })}
              placeholder="What Scouts do, how often you camp, costs, and what makes your unit special." />
          </section>

          <button className="btn-primary self-start" disabled={busy || !isAdmin} onClick={save}>Save and publish</button>
        </div>
      )}

      {tab === "photos" && (
        <div className="flex flex-col gap-4">
          <div className="card text-[13px]" style={{ background: "#F8F5EE" }}>
            Public photos show a Scout only if a parent gave photo consent (parents set it on their Family page). Tag Scouts in each photo; a photo tagged with any Scout who lacks consent stays members-only automatically. Captions should use first names only.
          </div>
          <form className="card flex gap-2 flex-wrap items-end" onSubmit={(e) => { e.preventDefault(); run(async () => {
            const { error } = await supabase.from("albums").insert({ org_id: orgId, title: album.title, taken_on: album.date || null, visibility: album.visibility });
            if (error) throw error; setAlbum({ title: "", date: "", visibility: "public" });
          }, "Album created."); }}>
            <Field label="New album"><input className="input" value={album.title} onChange={(e) => setAlbum({ ...album, title: e.target.value })} required placeholder="Campout - Caprock Canyons" /></Field>
            <Field label="Date"><input className="input" type="date" value={album.date} onChange={(e) => setAlbum({ ...album, date: e.target.value })} /></Field>
            <Field label="Who can see"><select className="input" value={album.visibility} onChange={(e) => setAlbum({ ...album, visibility: e.target.value })}><option value="public">Public</option><option value="members">Members only</option></select></Field>
            <button className="btn-primary" disabled={busy}>Create</button>
          </form>

          {albums.map((a) => (
            <div key={a.id} className="card flex flex-col gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <b className="text-[16px]">{a.title}</b>{a.taken_on && <span className="text-smoke text-[13px]">{fmtDate(a.taken_on, { month: "short", day: "numeric", year: "numeric" })}</span>}
                <Chip tone={a.visibility === "public" ? "green" : "gray"}>{a.visibility === "public" ? "Public" : "Members only"}</Chip>
                <label className="btn-secondary ml-auto cursor-pointer">Add photos
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
                    const files = [...(e.target.files ?? [])];
                    run(async () => {
                      // Keep going past a bad file and say exactly what happened, so a retry doesn't duplicate photos.
                      const failed: string[] = [];
                      for (const f of files) {
                        try {
                          const path = await upload(f, "photo");
                          const { error } = await supabase.from("photos").insert({ org_id: orgId, album_id: a.id, path });
                          if (error) throw error;
                        } catch { failed.push(f.name); }
                      }
                      if (failed.length) throw new Error(`${files.length - failed.length} of ${files.length} added. These didn't upload: ${failed.join(", ")}`);
                    }, `${files.length} photo(s) added. Tag Scouts so consent is checked.`);
                  }} />
                </label>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {a.photos.map((ph) => {
                  const noConsent = ph.tagged.filter((t) => nameOf[t]?.type === "youth" && !nameOf[t]?.consent);
                  return (
                    <div key={ph.id} className="flex flex-col gap-1" style={{ opacity: ph.hidden ? 0.4 : 1 }}>
                      <img src={storageUrl + ph.path} alt={ph.caption ?? ""} className="w-full aspect-[4/3] object-cover rounded-lg" loading="lazy" />
                      <div className="flex gap-1 flex-wrap">
                        {noConsent.length > 0 ? <Chip tone="orange">Members only: no consent</Chip> : <Chip tone="green">{ph.tagged.length ? `${ph.tagged.length} tagged` : "No one tagged"}</Chip>}
                      </div>
                      <div className="flex gap-2 text-[12px]">
                        <button className="btn-ghost text-[12px] min-h-0 px-0" onClick={() => setTagging(tagging === ph.id ? null : ph.id)}>Tag</button>
                        <button className="btn-ghost text-[12px] min-h-0 px-0" onClick={() => run(async () => {
                          const { error } = await supabase.from("photos").update({ hidden: !ph.hidden }).eq("id", ph.id); if (error) throw error;
                        })}>{ph.hidden ? "Show" : "Take down"}</button>
                      </div>
                      {tagging === ph.id && (
                        <div className="max-h-40 overflow-y-auto border border-border rounded-lg p-2 bg-white">
                          {people.filter((p) => p.type === "youth").map((p) => (
                            <label key={p.id} className="flex items-center gap-2 text-[12px]">
                              <input type="checkbox" checked={ph.tagged.includes(p.id)} disabled={busy} onChange={(e) => run(async () => {
                                // Read the current tags first: two quick taps must not drop one (an untagged no-consent
                                // Scout would leave the photo public).
                                const { data: cur, error: rErr } = await supabase.from("photos").select("tagged").eq("id", ph.id).single();
                                if (rErr) throw rErr;
                                const have: string[] = cur?.tagged ?? [];
                                const next = e.target.checked ? [...new Set([...have, p.id])] : have.filter((x) => x !== p.id);
                                const { data: done, error } = await supabase.from("photos").update({ tagged: next }).eq("id", ph.id).select("id");
                                if (error) throw error;
                                if (!done?.length) throw new Error("That photo didn't update. Reload and try again.");
                              })} />
                              {p.name} {!p.consent && <span style={{ color: "#5E4400" }}>(no consent)</span>}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "inbox" && (
        <div className="flex flex-col gap-2">
          {requests.length === 0 && <div className="card text-smoke">No messages from your public page yet.</div>}
          {requests.map((r) => (
            <div key={r.id} className="card flex flex-col gap-1" style={{ opacity: r.handled ? 0.6 : 1 }}>
              <div className="flex items-center gap-2 flex-wrap">
                <b>{r.name}</b> <a href={`mailto:${r.email}`} className="text-forest">{r.email}</a>{r.phone && <span>{r.phone}</span>}
                {r.to_person && <Chip>To {nameOf[r.to_person]?.name ?? "leader"}</Chip>}
                <span className="ml-auto text-[12px] text-smoke">{fmtStamp(r.created_at)}</span>
              </div>
              <div className="text-[15px] whitespace-pre-wrap">{r.message}</div>
              {!r.handled && <button className="btn-ghost self-start" onClick={() => run(async () => {
                const { error } = await supabase.from("contact_requests").update({ handled: true }).eq("id", r.id); if (error) throw error;
              })}>Mark handled</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

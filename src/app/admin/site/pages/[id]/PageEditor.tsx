"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Chip, ErrorBox, Field } from "@/components/ui";
import { BLOCK_LABELS, RenderBlocks, type Block, type BlockData } from "@/components/SiteBlocks";

// One list of allowed image types; the extension comes from the type, not the file name.
const IMAGE_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

type Page = { id: string; slug: string; title: string; visibility: string; show_in_menu: boolean; sort: number; draft: Block[]; published: Block[] | null; published_at: string | null; updated_at: string };

function blank(type: Block["type"]): Block {
  const id = crypto.randomUUID();
  switch (type) {
    case "heading": return { id, type, text: "" };
    case "text": return { id, type, text: "" };
    case "image": return { id, type, path: "", caption: "" };
    case "button": return { id, type, label: "", href: "" };
    case "video": return { id, type, url: "" };
    case "map": return { id, type, address: "" };
    case "album": return { id, type, album_id: "" };
    default: return { id, type } as Block;
  }
}

export default function PageEditor({ orgId, unitSlug, page, versions, albums, preview }: {
  orgId: string; unitSlug: string; page: Page; versions: { id: string; title: string; published_at: string }[];
  albums: { id: string; title: string; visibility: string }[]; preview: BlockData;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [blocks, setBlocks] = useState<Block[]>(page.draft);
  const [meta, setMeta] = useState({ title: page.title, visibility: page.visibility, show_in_menu: page.show_in_menu, sort: page.sort });
  const [view, setView] = useState<"edit" | "phone" | "desktop">("edit");
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const change = (next: Block[]) => { setBlocks(next); setDirty(true); setOk(""); };
  const update = (id: string, patch: Partial<Block>) => change(blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)));
  const move = (i: number, d: number) => { const n = [...blocks]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; change(n); };

  const run = async (fn: () => Promise<void>, msg: string) => {
    setBusy(true); setError(""); setOk("");
    try { await fn(); setOk(msg); router.refresh(); } catch (e: any) { setError(e.message ?? String(e)); }
    setBusy(false);
  };
  const saveDraft = async () => {
    const { error } = await supabase.from("web_pages").update({ draft: blocks, title: meta.title.trim(), visibility: meta.visibility, show_in_menu: meta.show_in_menu, sort: meta.sort, updated_at: new Date().toISOString() }).eq("id", page.id);
    if (error) throw error; setDirty(false);
  };

  const upload = async (file: File) => {
    if (file.size > 8_000_000) throw new Error("Images must be under 8 MB.");
    const ext = IMAGE_EXT[file.type];
    if (!ext) throw new Error("Upload a JPG, PNG, WEBP or GIF image.");
    const path = `${orgId}/page-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("site").upload(path, file, { cacheControl: "31536000" });
    if (error) throw error;
    return path;
  };

  const live = page.published_at ? `/${unitSlug}/${page.slug}` : null;

  return (
    <div className="flex flex-col gap-4">
      <a href="/admin/site/pages" className="text-[13px] font-bold text-forest no-underline">← Pages</a>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display font-extrabold text-[32px] m-0">{meta.title || "Untitled"}</h1>
          <div className="flex gap-1.5 mt-1 items-center flex-wrap text-[13px]">
            {!page.published_at ? <Chip tone="orange">Draft, not live</Chip> : <Chip tone="green">Live since {new Date(page.published_at).toLocaleDateString()}</Chip>}
            {dirty && <Chip tone="orange">Unsaved changes</Chip>}
            {live && <a href={live} target="_blank" className="font-bold text-forest">View live page</a>}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["edit", "phone", "desktop"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={view === v ? "btn-primary" : "btn-secondary"}>{v === "edit" ? "Edit" : v === "phone" ? "Phone preview" : "Desktop preview"}</button>
          ))}
        </div>
      </div>
      <ErrorBox>{error}</ErrorBox>
      {ok && <div className="card font-bold" style={{ background: "#EEE8D9" }}>{ok}</div>}

      {view !== "edit" ? (
        <div className="mx-auto w-full rounded-2xl border bg-paper p-4" style={{ maxWidth: view === "phone" ? 390 : 960, borderColor: "#DDD6C5" }}>
          <h1 className="font-display font-extrabold text-[28px] mt-0">{meta.title}</h1>
          <RenderBlocks blocks={blocks} data={preview} />
        </div>
      ) : (
        <>
          <div className="card grid md:grid-cols-4 gap-3">
            <Field label="Page name"><input className="input" value={meta.title} maxLength={80} onChange={(e) => { setMeta({ ...meta, title: e.target.value }); setDirty(true); }} /></Field>
            <Field label="Who can see it">
              <select className="input" value={meta.visibility} onChange={(e) => { setMeta({ ...meta, visibility: e.target.value }); setDirty(true); }}>
                <option value="public">Anyone (public)</option><option value="members">Signed-in members only</option>
              </select>
            </Field>
            <Field label="Menu order" hint="Lower numbers come first"><input className="input" inputMode="numeric" value={meta.sort} onChange={(e) => { setMeta({ ...meta, sort: Number(e.target.value) || 0 }); setDirty(true); }} /></Field>
            <label className="flex items-center gap-2 font-bold text-[14px]" style={{ minHeight: 44 }}>
              <input type="checkbox" className="w-5 h-5" checked={meta.show_in_menu} onChange={(e) => { setMeta({ ...meta, show_in_menu: e.target.checked }); setDirty(true); }} /> Show in the menu
            </label>
          </div>

          {blocks.map((b, i) => (
            <div key={b.id} className="card flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <b className="text-[14px]">{BLOCK_LABELS[b.type]}</b>
                <div className="ml-auto flex gap-1">
                  <button className="btn-ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                  <button className="btn-ghost" aria-label="Move down" disabled={i === blocks.length - 1} onClick={() => move(i, 1)}>↓</button>
                  <button className="btn-ghost" onClick={() => change(blocks.filter((x) => x.id !== b.id))}>Remove</button>
                </div>
              </div>
              {b.type === "heading" && <input className="input" value={b.text} onChange={(e) => update(b.id, { text: e.target.value })} placeholder="Heading" />}
              {b.type === "text" && <textarea className="input" rows={5} value={b.text} onChange={(e) => update(b.id, { text: e.target.value })} placeholder="Write here. Use first names only for Scouts, and never share a Scout's school, address, phone or email." />}
              {b.type === "image" && (
                <div className="flex flex-col gap-2">
                  {b.path && <img src={preview.storageUrl + b.path} alt="" className="max-h-48 rounded-lg self-start" />}
                  <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) run(async () => { const path = await upload(f); update(b.id, { path }); }, "Image uploaded. Save to keep it."); }} />
                  <input className="input" value={b.caption ?? ""} onChange={(e) => update(b.id, { caption: e.target.value })} placeholder="Caption (optional)" />
                  <div className="text-[12px] text-smoke">For photos of Scouts, use a photo album block instead: albums only show photos with a parent&apos;s photo consent.</div>
                </div>
              )}
              {b.type === "button" && <div className="grid md:grid-cols-2 gap-2">
                <input className="input" value={b.label} onChange={(e) => update(b.id, { label: e.target.value })} placeholder="Button text" />
                <input className="input" value={b.href} onChange={(e) => update(b.id, { href: e.target.value })} placeholder="Link (https://… or /page)" />
              </div>}
              {b.type === "video" && <input className="input" value={b.url} onChange={(e) => update(b.id, { url: e.target.value })} placeholder="YouTube or Vimeo link" />}
              {b.type === "map" && <input className="input" value={b.address} onChange={(e) => update(b.id, { address: e.target.value })} placeholder="Meeting place address" />}
              {b.type === "album" && (
                <select className="input" value={b.album_id} onChange={(e) => update(b.id, { album_id: e.target.value })}>
                  <option value="">Pick an album</option>
                  {albums.map((a) => <option key={a.id} value={a.id}>{a.title}{a.visibility !== "public" ? " (members only, will not show)" : ""}</option>)}
                </select>
              )}
              {b.type === "events" && <div className="text-[13px] text-smoke">Shows your next public events automatically.</div>}
              {b.type === "join" && <div className="text-[13px] text-smoke">A button that opens your join request form.</div>}
            </div>
          ))}

          <div className="card flex flex-wrap gap-2 items-center">
            <span className="font-bold text-[14px]">Add a block:</span>
            {(Object.keys(BLOCK_LABELS) as Block["type"][]).map((t) => (
              <button key={t} className="btn-secondary" onClick={() => change([...blocks, blank(t)])}>{BLOCK_LABELS[t]}</button>
            ))}
          </div>
        </>
      )}

      <div className="flex gap-2 flex-wrap sticky bottom-0 py-3 bg-canvas">
        <button className="btn-secondary" disabled={busy || !dirty} onClick={() => run(saveDraft, "Draft saved. It isn't live until you publish.")}>Save draft</button>
        <button className="btn-primary" disabled={busy || !meta.title.trim()} onClick={() => run(async () => {
          if (dirty) await saveDraft();
          const { error } = await supabase.rpc("publish_site_page", { p_page: page.id }); if (error) throw error;
        }, meta.visibility === "members" ? "Published for signed-in members." : "Published. It's live on your site.")}>Publish</button>
        {page.published_at && (
          <button className="btn-secondary" disabled={busy} onClick={() => run(async () => {
            const { error } = await supabase.from("web_pages").update({ published: null, published_at: null }).eq("id", page.id); if (error) throw error;
          }, "Taken down. The page is a draft again.")}>Unpublish</button>
        )}
        <button className="btn-ghost ml-auto" disabled={busy} onClick={() => { if (confirm("Delete this page and its history?")) run(async () => {
          const { error } = await supabase.from("web_pages").delete().eq("id", page.id); if (error) throw error; router.push("/admin/site/pages");
        }, "Deleted."); }}>Delete page</button>
      </div>

      {versions.length > 0 && (
        <div className="card flex flex-col gap-1">
          <div className="font-bold text-[15px]">History</div>
          <p className="text-[13px] text-smoke m-0">Each publish is saved. Restoring loads that version into the draft so you can check it before publishing.</p>
          {versions.map((v) => (
            <div key={v.id} className="flex items-center gap-2 border-t py-1.5" style={{ borderColor: "#EAE4D6" }}>
              <span className="text-[14px]">{new Date(v.published_at).toLocaleString()}</span>
              <button className="btn-ghost ml-auto" disabled={busy} onClick={() => {
                // A saved-but-unpublished draft isn't in the history, so restoring would lose it too.
                const unpublished = page.published_at === null || JSON.stringify(blocks) !== JSON.stringify(page.published ?? []);
                if ((dirty || unpublished) && !confirm("Restoring replaces your current draft, including changes that were never published. Continue?")) return;
                run(async () => {
                  const { data, error } = await supabase.rpc("restore_site_version", { p_version: v.id }); if (error) throw error;
                  const r = data as { title: string; blocks: Block[] };
                  setBlocks(r.blocks); setMeta((m) => ({ ...m, title: r.title })); setDirty(false);
                }, "Restored into the draft, including its title. Publish to make it live.");
              }}>Restore</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ErrorBox } from "@/components/ui";

const toSlug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

export default function NewPage({ orgId, taken }: { orgId: string; taken: string[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form className="card flex gap-2 flex-wrap items-end" onSubmit={async (e) => {
      e.preventDefault(); setError("");
      const slug = toSlug(title);
      if (!slug) { setError("Give the page a name with letters or numbers."); return; }
      if (taken.includes(slug)) { setError("You already have a page with that address."); return; }
      setBusy(true);
      const { data, error } = await supabase.from("web_pages").insert({
        org_id: orgId, slug, title: title.trim(), sort: (taken.length + 1) * 10,
        draft: [{ id: crypto.randomUUID(), type: "heading", text: title.trim() }, { id: crypto.randomUUID(), type: "text", text: "" }],
      }).select("id").single();
      setBusy(false);
      if (error?.code === "23505") { setError("You already have a page with that address."); return; }
      if (error || !data) { setError(error?.message ?? "Could not create the page"); return; }
      router.push(`/admin/site/pages/${data.id}`);
    }}>
      <label className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
        <span className="font-bold text-[14px]">New page name</span>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="New families" required />
      </label>
      <button className="btn-primary" disabled={busy}>Create page</button>
      <div className="w-full"><ErrorBox>{error}</ErrorBox></div>
    </form>
  );
}

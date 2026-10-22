"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ErrorBox, Field } from "@/components/ui";

export default function NewTopic({ orgId, personId, isAdult }: { orgId: string; personId: string; isAdult: boolean }) {
  const supabase = createClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("everyone");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Posts are permanent, so a failed first post retries into the same topic instead of starting another.
  const [topicId, setTopicId] = useState<string | null>(null);

  if (!open) return <button className="btn-primary self-start" onClick={() => setOpen(true)}>Start a conversation</button>;

  return (
    <form className="card flex flex-col gap-3" onSubmit={async (e) => {
      e.preventDefault(); if (busy) return; setBusy(true); setError("");
      let t = topicId ? { id: topicId } : null;
      if (!t) {
        const { data, error: e1 } = await supabase.from("forum_topics")
          .insert({ org_id: orgId, title: title.trim(), audience: isAdult ? audience : "everyone", created_by: personId }).select("id").single();
        if (e1 || !data) { setError(e1?.message ?? "Could not start it"); setBusy(false); return; }
        t = data; setTopicId(data.id);
      }
      const { error: e2 } = await supabase.from("forum_posts").insert({ topic_id: t.id, org_id: orgId, author_id: personId, body: body.trim() });
      if (e2) { setError(e2.message); setBusy(false); return; }
      router.push(`/forum/${t.id}`);
    }}>
      <Field label="Topic"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required /></Field>
      <Field label="First post"><textarea className="input" rows={4} value={body} onChange={(e) => setBody(e.target.value)} required /></Field>
      {isAdult && (
        <Field label="Who can see it" hint="Scouts can't see adults-only boards. Everything posted is saved and can't be deleted.">
          <select className="input" value={audience} onChange={(e) => setAudience(e.target.value)}>
            <option value="everyone">Everyone in the unit (Scouts, parents and leaders)</option>
            <option value="adults">Adults only</option>
          </select>
        </Field>
      )}
      <ErrorBox>{error}</ErrorBox>
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy}>Post</button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

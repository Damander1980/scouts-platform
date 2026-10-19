"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ErrorBox } from "@/components/ui";

export default function TopicClient({ topicId, orgId, personId, locked, pinned, canModerate }: {
  topicId: string; orgId: string; personId: string; locked: boolean; pinned: boolean; canModerate: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await fn(); router.refresh(); } catch (e: any) { setError(e.message ?? String(e)); }
    setBusy(false);
  };
  const flag = (patch: { locked?: boolean; pinned?: boolean }) => run(async () => {
    const { error } = await supabase.from("forum_topics").update(patch).eq("id", topicId); if (error) throw error;
  });

  return (
    <div className="flex flex-col gap-3">
      {locked ? <div className="card text-smoke">This conversation is locked. No new posts.</div> : (
        <form className="card flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); run(async () => {
          const { error } = await supabase.from("forum_posts").insert({ topic_id: topicId, org_id: orgId, author_id: personId, body: body.trim() });
          if (error) throw error; setBody("");
        }); }}>
          <textarea className="input" rows={3} placeholder="Write a reply. It's saved and can't be edited or deleted." value={body} onChange={(e) => setBody(e.target.value)} required />
          <button className="btn-primary self-start" disabled={busy}>Reply</button>
        </form>
      )}
      <ErrorBox>{error}</ErrorBox>
      {canModerate && (
        <div className="flex gap-2">
          <button className="btn-secondary" disabled={busy} onClick={() => flag({ locked: !locked })}>{locked ? "Unlock" : "Lock"}</button>
          <button className="btn-secondary" disabled={busy} onClick={() => flag({ pinned: !pinned })}>{pinned ? "Unpin" : "Pin to top"}</button>
        </div>
      )}
    </div>
  );
}

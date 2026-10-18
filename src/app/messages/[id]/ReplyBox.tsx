"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ErrorBox } from "@/components/ui";

export default function ReplyBox({ orgId, messageId }: { orgId: string; messageId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    setBusy(true); setError("");
    const { data, error } = await supabase.rpc("send_message", {
      p_org: orgId, p_subject: null, p_body: body, p_audience: "reply", p_ref: messageId, p_person_ids: null,
    });
    if (error) setError(error.message);
    else {
      fetch("/api/notify/message", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: data }) }).catch(() => {});
      setBody("");
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="card flex flex-col gap-2">
      <ErrorBox>{error}</ErrorBox>
      <textarea className="input py-3 min-h-[90px]" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Reply to everyone on this message" />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] text-smoke">Replies go to the whole group. There are no private threads with Scouts.</span>
        <button className="btn-primary" disabled={busy || !body.trim()} onClick={send}>{busy ? "Sending…" : "Reply"}</button>
      </div>
    </div>
  );
}

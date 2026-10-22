"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CounselorSign({ progressId }: { progressId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col items-end gap-1">
      <button className="btn-primary" disabled={busy} onClick={async () => {
        setBusy(true); setError("");
        const { data: { user } } = await supabase.auth.getUser();
        const { data: me } = user ? await supabase.from("persons").select("id").eq("user_id", user.id).maybeSingle() : { data: null };
        if (!me) { setError("Sign in again, then try once more."); setBusy(false); return; }
        // .select() so a change that didn't land (unchecked meanwhile, or not allowed) isn't shown as signed.
        const { data: done, error } = await supabase.from("requirement_progress").update({ approved_by: me.id, approved_at: new Date().toISOString() }).eq("id", progressId).select("id");
        if (error) setError(error.message);
        else if (!done?.length) setError("That item changed before you signed it. Reload and check it again.");
        else router.refresh();
        setBusy(false);
      }}>Sign off</button>
      {error && <span className="text-[12px] font-bold" style={{ color: "#A52A1C" }}>{error}</span>}
    </div>
  );
}

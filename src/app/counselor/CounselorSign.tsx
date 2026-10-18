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
        const { data: me } = await supabase.from("persons").select("id").eq("user_id", user!.id).single();
        const { error } = await supabase.from("requirement_progress").update({ approved_by: me!.id, approved_at: new Date().toISOString() }).eq("id", progressId);
        if (error) setError(error.message); else router.refresh();
        setBusy(false);
      }}>Sign off</button>
      {error && <span className="text-[12px] font-bold" style={{ color: "#A52A1C" }}>{error}</span>}
    </div>
  );
}

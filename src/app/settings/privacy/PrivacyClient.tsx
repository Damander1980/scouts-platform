"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Chip, ErrorBox } from "@/components/ui";

type Req = { id: string; person_id: string; status: string; execute_after: string; created_at: string };

export default function PrivacyClient({ family, requests }: { family: { id: string; name: string; type: string }[]; requests: Req[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState<Record<string, string>>({});
  const run = async (fn: () => Promise<void>) => { setBusy(true); setError(""); try { await fn(); router.refresh(); } catch (e: any) { setError(e.message); } setBusy(false); };
  const nameOf = Object.fromEntries(family.map((f) => [f.id, f.name]));

  return (
    <div className="flex flex-col gap-4 max-w-xl">
      <ErrorBox>{error}</ErrorBox>
      <div className="card text-[14px] flex flex-col gap-2">
        <b>What we keep and why</b>
        <p className="m-0">We never sell data or show ads. Only a parent or guardian can ask to delete a child&apos;s messages, profile and photos. Completed medical forms are never stored here.</p>
        <p className="m-0 text-smoke">When you confirm a request, there is a 14-day waiting period and your unit&apos;s admins are told. A request can pause if a safety report is open or the law requires the records be kept, and you will be told why.</p>
      </div>

      {requests.map((r) => (
        <div key={r.id} className="card flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <b>{nameOf[r.person_id] ?? "Family member"}</b>
            <Chip tone={r.status === "canceled" ? "gray" : r.status === "paused" ? "red" : "orange"}>{r.status}</Chip>
            <span className="text-[12px] text-smoke ml-auto">asked {new Date(r.created_at).toLocaleDateString()}</span>
          </div>
          {r.status === "pending" && (
            <div className="flex flex-col gap-2">
              <p className="text-[14px] m-0">Type <b>DELETE</b> to confirm. This starts the 14-day waiting period.</p>
              <div className="flex gap-2">
                <input className="input" value={typed[r.id] ?? ""} onChange={(e) => setTyped({ ...typed, [r.id]: e.target.value })} placeholder="DELETE" />
                <button className="btn-primary" disabled={busy || (typed[r.id] ?? "").trim().toUpperCase() !== "DELETE"} onClick={() => run(async () => {
                  const { error } = await supabase.rpc("confirm_deletion", { p_request: r.id }); if (error) throw error;
                })}>Confirm</button>
              </div>
            </div>
          )}
          {r.status === "confirmed" && <p className="text-[14px] m-0">Confirmed. This is scheduled after {new Date(r.execute_after).toLocaleDateString()}. You can cancel until then.</p>}
          {["pending", "confirmed", "paused"].includes(r.status) && (
            <button className="btn-ghost self-start" disabled={busy} onClick={() => run(async () => {
              const { error } = await supabase.rpc("cancel_deletion", { p_request: r.id }); if (error) throw error;
            })}>Cancel request</button>
          )}
        </div>
      ))}

      <div className="card flex flex-col gap-2">
        <b>Ask to delete a family member&apos;s data</b>
        {family.map((f) => (
          <div key={f.id} className="flex items-center gap-2">
            <span className="flex-1">{f.name} <span className="text-smoke text-[13px]">({f.type})</span></span>
            <button className="btn-secondary" disabled={busy || requests.some((r) => r.person_id === f.id && ["pending", "confirmed", "paused"].includes(r.status))}
              onClick={() => run(async () => { const { error } = await supabase.rpc("request_deletion", { p_person: f.id }); if (error) throw error; })}>Request</button>
          </div>
        ))}
      </div>
    </div>
  );
}

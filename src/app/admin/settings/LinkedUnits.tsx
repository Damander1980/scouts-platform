"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Chip, ErrorBox } from "@/components/ui";

type Link = { link_id: string; org_id: string; name: string; status: string; incoming: boolean };

export default function LinkedUnits({ orgId, joinCode, links, isAdmin }: { orgId: string; joinCode: string; links: Link[]; isAdmin: boolean }) {
  const supabase = createClient();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true); setError(""); setOk("");
    try { const m = await fn(); if (m) setOk(m); router.refresh(); } catch (e: any) { setError(e.message ?? String(e)); }
    setBusy(false);
  };

  return (
    <div className="card flex flex-col gap-3">
      <div>
        <div className="font-bold text-[16px]">Linked units</div>
        <p className="text-[13px] text-smoke m-0 mt-1">
          Link with a sister unit, such as a girls&apos; troop or your pack, to share events on each other&apos;s calendars.
          Rosters, money and sign-ups stay separate. Your join code for them to use: <b>{joinCode}</b>
        </p>
      </div>
      {links.length === 0 && <div className="text-[14px] text-smoke">No linked units.</div>}
      {links.map((l) => (
        <div key={l.link_id} className="flex items-center gap-2 flex-wrap border-t pt-2" style={{ borderColor: "#EAE4D6" }}>
          <b className="text-[15px]">{l.name}</b>
          {l.status === "accepted" ? <Chip tone="green">Linked</Chip> : <Chip tone="orange">{l.incoming ? "Wants to link" : "Waiting for them"}</Chip>}
          {isAdmin && l.status === "pending" && l.incoming && (
            <button className="btn-primary" disabled={busy} onClick={() => run(async () => {
              const { error } = await supabase.rpc("accept_unit_link", { p_link: l.link_id }); if (error) throw error; return `Linked with ${l.name}.`;
            })}>Accept</button>
          )}
          {isAdmin && (
            <button className="btn-secondary" disabled={busy} onClick={() => run(async () => {
              const { error } = await supabase.from("unit_links").delete().eq("id", l.link_id); if (error) throw error;
            })}>{l.status === "accepted" ? "Unlink" : "Cancel"}</button>
          )}
        </div>
      ))}
      {isAdmin && (
        <form className="flex gap-2 flex-wrap items-end" onSubmit={(e) => { e.preventDefault(); run(async () => {
          const { data, error } = await supabase.rpc("request_unit_link", { p_org: orgId, p_code: code }); if (error) throw error;
          setCode(""); return `Request sent to ${data}. Their admin needs to accept it.`;
        }); }}>
          <input aria-label="Their join code" className="input w-48" placeholder="Their join code" value={code} onChange={(e) => setCode(e.target.value)} required />
          <button className="btn-secondary" disabled={busy}>Ask to link</button>
        </form>
      )}
      <ErrorBox>{error}</ErrorBox>
      {ok && <div className="text-[14px] font-bold text-forest">{ok}</div>}
    </div>
  );
}

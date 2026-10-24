"use client";

import PasswordInput from "@/components/PasswordInput";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ErrorBox, Field, fmtStamp } from "@/components/ui";

const CONSENT = "I hold this Scoutbook position for this unit and allow Our Troop Manager to sign in to Scoutbook as me to copy roster and advancement both ways. I can remove this at any time, which deletes my stored login.";
const POSITIONS: [string, string][] = [
  ["unit_leader", "Unit leader (Scoutmaster)"], ["committee_chair", "Committee chair"], ["chartered_org_rep", "Chartered organization representative"],
  ["unit_advancement_chair", "Unit advancement chair"], ["key3_delegate", "Key 3 delegate"],
];

// Shown only when NEXT_PUBLIC_SCOUTBOOK_SYNC is on, so nobody stores a login before the sync works.
export default function ScoutbookConnect({ orgId, canConnect, connection }: {
  orgId: string; canConnect: boolean;
  connection: { scoutbook_username: string; scoutbook_position: string; created_at: string; last_sync_at: string | null; last_error: string | null } | null;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [f, setF] = useState({ username: "", password: "", position: "unit_advancement_chair", consent: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [test, setTest] = useState("");

  async function testConnection() {
    setBusy(true); setTest(""); setError("");
    const res = await fetch("/api/scoutbook/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orgId }) }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : { error: "Couldn't reach the server. Check your connection and try again." };
    if (body.ok) setTest(`Connected. Scoutbook answered and listed ${body.ranks} ranks.`); else setError(body.error ?? "Couldn't reach Scoutbook.");
    setBusy(false);
    router.refresh();
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const { error } = await supabase.rpc("save_scoutbook_login", { p_org: orgId, p_username: f.username, p_password: f.password, p_position: f.position, p_consent: CONSENT });
    setF({ ...f, password: "" });
    if (error) setError(error.message); else router.refresh();
    setBusy(false);
  }
  async function remove() {
    setBusy(true); setError("");
    const { error } = await supabase.rpc("remove_scoutbook_login", { p_org: orgId });
    if (error) setError(error.message); else router.refresh();
    setBusy(false);
  }

  return (
    <section className="card flex flex-col gap-3">
      <div className="font-bold text-[16px]">Scoutbook sync</div>
      <ErrorBox>{error}</ErrorBox>
      {connection ? (
        <>
          <p className="text-[14px] m-0">
            Connected as <b>{connection.scoutbook_username}</b> ({POSITIONS.find(([k]) => k === connection.scoutbook_position)?.[1] ?? connection.scoutbook_position}).
            {connection.last_sync_at ? ` Last synced ${fmtStamp(connection.last_sync_at)}.` : " Not synced yet."}
          </p>
          {connection.last_error && <p className="text-[13px] m-0" style={{ color: "#A52A1C" }}>Last sync problem: {connection.last_error}</p>}
          {test && <p className="text-[14px] font-bold m-0 text-forest">{test}</p>}
          {canConnect && (
            <div className="flex gap-2 flex-wrap">
              <button className="btn-primary" disabled={busy} onClick={testConnection}>{busy ? "Checking…" : "Test connection"}</button>
              <button className="btn-secondary" disabled={busy} onClick={remove}>Turn off and delete my stored login</button>
            </div>
          )}
        </>
      ) : canConnect ? (
        <form onSubmit={save} className="flex flex-col gap-3">
          <p className="text-[13px] text-smoke m-0">
            Scoutbook has no official connection, so sync signs in as you. Your password is encrypted and never shown again, even to admins. Only your Scoutbook position can enter advancement, so use your own login.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Scoutbook (my.scouting.org) username"><input className="input" autoComplete="off" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} required /></Field>
            <Field label="Password"><PasswordInput className="input w-full" autoComplete="off" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></Field>
          </div>
          <Field label="Your Scoutbook position">
            <select className="input" value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })}>
              {POSITIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          <label className="flex items-start gap-3 text-[14px]">
            <input type="checkbox" className="w-5 h-5 mt-0.5" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} required />
            <span>{CONSENT}</span>
          </label>
          <button className="btn-primary self-start" disabled={busy || !f.consent}>{busy ? "Saving…" : "Connect Scoutbook"}</button>
        </form>
      ) : (
        <p className="text-[14px] text-smoke m-0">Not connected. A Key 3 leader or the advancement chair can connect it.</p>
      )}
    </section>
  );
}

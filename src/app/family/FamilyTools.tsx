"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ErrorBox, Field } from "@/components/ui";

export default function FamilyTools({ defaultLast, notInTroop, orgId }: {
  defaultLast: string; notInTroop: { id: string; name: string }[]; orgId: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState(defaultLast);
  const [birth, setBirth] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(""); setMsg("");
    try { await fn(); } catch (e: any) { setError(e.message); }
    setBusy(false);
  };

  return (
    <section className="grid md:grid-cols-2 gap-3">
      <ErrorBox>{error}</ErrorBox>
      {msg && <div className="card md:col-span-2 font-bold" style={{ background: "#EEE8D9" }}>{msg}</div>}

      <form className="card flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); run(async () => {
        const { error } = await supabase.rpc("add_child", { p_first: first, p_last: last, p_birthdate: birth || null });
        if (error) throw error;
        setFirst(""); setBirth(""); setMsg("Child added. Ask to add them to the troop below.");
        router.refresh();
      }); }}>
        <div className="font-bold text-[16px]">Add a child</div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="First name"><input className="input" value={first} onChange={(e) => setFirst(e.target.value)} required /></Field>
          <Field label="Last name"><input className="input" value={last} onChange={(e) => setLast(e.target.value)} required /></Field>
        </div>
        <Field label="Birthday"><input className="input" type="date" value={birth} onChange={(e) => setBirth(e.target.value)} /></Field>
        <button className="btn-secondary" disabled={busy}>Add</button>
      </form>

      <div className="card flex flex-col gap-3">
        <div className="font-bold text-[16px]">Add your spouse or co-parent</div>
        <p className="text-[13px] text-smoke m-0">Give them this one-time code. After they sign in, they enter it to join your family. It works for 14 days.</p>
        {code ? (
          <div className="font-display font-extrabold text-[28px] tracking-widest text-center py-2 rounded-xl" style={{ background: "#EEE8D9" }}>{code}</div>
        ) : (
          <button className="btn-secondary" disabled={busy} onClick={() => run(async () => {
            const { data, error } = await supabase.rpc("create_household_invite");
            if (error) throw error;
            setCode(String(data));
          })}>Create family code</button>
        )}
      </div>

      {notInTroop.length > 0 && (
        <div className="card flex flex-col gap-3 md:col-span-2">
          <div className="font-bold text-[16px]">Not in this unit yet</div>
          <p className="text-[13px] text-smoke m-0">Send a request and a leader will approve it.</p>
          <button className="btn-primary" disabled={busy} onClick={() => run(async () => {
            const { error } = await supabase.rpc("request_join", { p_org: orgId, p_person_ids: notInTroop.map((p) => p.id), p_note: null });
            if (error) throw error;
            setMsg(`Request sent for ${notInTroop.map((p) => p.name).join(", ")}.`);
          })}>Ask to add {notInTroop.map((p) => p.name).join(", ")}</button>
        </div>
      )}
    </section>
  );
}

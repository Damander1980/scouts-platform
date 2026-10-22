"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ChildLogin({ personId, name, age, email, linked }: { personId: string; name: string; age: number | null; email: string | null; linked: boolean }) {
  const supabase = createClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mail, setMail] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const under13 = age !== null && age < 13;
  const consent =
    `I am ${name}'s parent or legal guardian. I give permission for ${name} to have their own ScoutPlatform login using the email I entered, ` +
    `and for ScoutPlatform to collect the information ${name} enters in order to run their Scouting activities. I understand every message ${name} sends or receives ` +
    `is saved and copied to me and to unit leaders, and I can remove ${name}'s login or request deletion of their data at any time.`;

  async function save() {
    setBusy(true); setError("");
    const { error } = await supabase.rpc("invite_child_login", { p_person: personId, p_email: mail, p_consent_text: consent });
    if (error) setError(error.message); else { setOpen(false); router.refresh(); }
    setBusy(false);
  }

  if (linked) {
    return (
      <div className="flex items-center gap-2 text-[13px] flex-wrap">
        <span>{name} has their own login{email ? ` (${email})` : ""}.</span>
        <button className="btn-ghost text-[13px] min-h-0 px-0" disabled={busy} onClick={async () => {
          setBusy(true); const { error } = await supabase.rpc("revoke_child_login", { p_person: personId });
          if (error) setError(error.message); else router.refresh(); setBusy(false);
        }}>Remove login</button>
      </div>
    );
  }
  if (email) {
    return <div className="text-[13px]">Waiting for {name} to sign in with <b>{email}</b>. They open the sign-in page, choose Create an account with that email, and pick their own password.{" "}
      <button className="btn-ghost text-[13px] min-h-0 px-0" disabled={busy} onClick={async () => {
        setBusy(true); const { error } = await supabase.rpc("revoke_child_login", { p_person: personId });
        if (error) setError(error.message); else router.refresh(); setBusy(false);
      }}>Cancel</button>{error && <span className="block text-[13px] font-bold" style={{ color: "#A52A1C" }}>{error}</span>}</div>;
  }
  return (
    <div className="flex flex-col gap-2">
      {!open ? (
        <button className="btn-secondary self-start min-h-[36px] text-[13px]" onClick={() => setOpen(true)}>Give {name} their own login</button>
      ) : (
        <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background: "#F8F5EE" }}>
          <div className="text-[13px]">Scouts take responsibility for their own sign-ups, advancement and messages. {name} signs in with their own email and password.</div>
          <input className="input" type="email" placeholder={`${name}'s email`} value={mail} onChange={(e) => setMail(e.target.value)} />
          <label className="flex items-start gap-3 text-[13px]">
            <input type="checkbox" className="w-5 h-5 mt-0.5 flex-none" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>{consent}{under13 ? " I understand that because my child is under 13, I am giving this consent on their behalf." : ""}</span>
          </label>
          {error && <div className="text-[13px] font-bold" style={{ color: "#A52A1C" }}>{error}</div>}
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy || !agree || !mail} onClick={save}>Save</button>
            <button className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

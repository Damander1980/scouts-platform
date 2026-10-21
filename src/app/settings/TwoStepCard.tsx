"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Shows whether two-step sign-in is set up and lets the person move it to a new phone.
// Removing a factor needs a verified (aal2) session, so a stolen password alone can't turn it off.
export default function TwoStepCard() {
  const supabase = createClient();
  const [state, setState] = useState<{ factorId: string | null; aal2: boolean } | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: f }, { data: aal }] = await Promise.all([supabase.auth.mfa.listFactors(), supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
      setState({ factorId: f?.totp.find((x) => x.status === "verified")?.id ?? null, aal2: aal?.currentLevel === "aal2" });
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!state) return null;

  async function reset() {
    if (!state?.factorId) return;
    setMsg("");
    const { error } = await supabase.auth.mfa.unenroll({ factorId: state.factorId });
    if (error) { setMsg(error.message); return; }
    window.location.href = "/two-step?next=/admin";
  }

  return (
    <section className="card flex flex-col gap-2">
      <div className="font-bold text-[16px]">Two-step sign-in</div>
      {state.factorId ? (
        <>
          <p className="text-[14px] text-smoke m-0">On. Leader tools ask for a code from your authenticator app.</p>
          {state.aal2 ? (
            <button className="btn-secondary self-start" onClick={reset}>Move to a new phone</button>
          ) : (
            <a href="/two-step?next=/settings" className="btn-secondary self-start no-underline">Enter a code to change this</a>
          )}
          <p className="text-[12px] text-smoke m-0">Lost your phone? Contact support and we&apos;ll verify it&apos;s you before resetting it.</p>
        </>
      ) : (
        <>
          <p className="text-[14px] text-smoke m-0">Not set up. Leaders, treasurers and admins need it to open leader tools.</p>
          <a href="/two-step?next=/settings" className="btn-secondary self-start no-underline">Set it up</a>
        </>
      )}
      {msg && <p role="alert" className="text-sm m-0" style={{ color: "#5E4400" }}>{msg}</p>}
    </section>
  );
}

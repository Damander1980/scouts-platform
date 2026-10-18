"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignPermission({ orgId, personId, name }: { orgId: string; personId: string; name: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background: "#F4F8F6" }}>
      <label className="flex items-start gap-3 text-[14px]">
        <input type="checkbox" className="w-5 h-5 mt-0.5 flex-none" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>
          I am {name}&apos;s parent or legal guardian. I give permission for {name} to take part in this unit&apos;s activities for the next 12 months,
          including travel by private vehicle with registered adult leaders, and I understand the unit will tell me about each event in advance.
        </span>
      </label>
      {error && <div className="text-[13px] font-bold" style={{ color: "#A52A1C" }}>{error}</div>}
      <button className="btn-primary self-start" disabled={!agree} onClick={async () => {
        const { error } = await supabase.rpc("sign_permission", { p_org: orgId, p_person: personId });
        if (error) setError(error.message); else router.refresh();
      }}>Sign for {name}</button>
    </div>
  );
}

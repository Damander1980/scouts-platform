"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ErrorBox } from "@/components/ui";
import { SKILLS } from "@/lib/skills";

type Row = { skills: string[]; other: string | null; can_drive: boolean } | null;

export default function SkillsCard({ orgId, personId, unitName, initial }: { orgId: string; personId: string; unitName: string; initial: Row }) {
  const supabase = createClient();
  const [skills, setSkills] = useState<string[]>(initial?.skills ?? []);
  const [other, setOther] = useState(initial?.other ?? "");
  const [drive, setDrive] = useState(initial?.can_drive ?? false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const flip = (s: string) => { setSaved(false); setSkills((cur) => cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]); };

  async function save() {
    setBusy(true); setError(""); setSaved(false);
    const { error } = await supabase.from("adult_skills").upsert(
      { org_id: orgId, person_id: personId, skills, other: other.trim() || null, can_drive: drive, updated_at: new Date().toISOString() },
      { onConflict: "org_id,person_id" });
    if (error) setError(error.message); else setSaved(true);
    setBusy(false);
  }

  return (
    <div className="card flex flex-col gap-3">
      <div>
        <div className="font-bold text-[16px]">How I can help {unitName}</div>
        <p className="text-[13px] text-smoke m-0 mt-1">Leaders see this when they need a hand. Only leaders can see it, and you can change it any time.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {SKILLS.map((s) => {
          const on = skills.includes(s);
          return (
            <button key={s} type="button" onClick={() => flip(s)} className="px-3 rounded-full text-[13px] font-bold border cursor-pointer font-sans"
              style={{ minHeight: 44, background: on ? "#12355F" : "white", color: on ? "white" : "#4B5568", borderColor: on ? "#12355F" : "#DDD6C5" }}>{s}</button>
          );
        })}
      </div>
      <label className="flex items-center gap-2 text-[14px] font-bold" style={{ minHeight: 44 }}>
        <input type="checkbox" className="w-5 h-5" checked={drive} onChange={(e) => { setDrive(e.target.checked); setSaved(false); }} />
        I can usually drive to campouts
      </label>
      <input className="input" placeholder="Anything else (job, hobbies, certifications)" value={other} onChange={(e) => { setOther(e.target.value); setSaved(false); }} />
      <ErrorBox>{error}</ErrorBox>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={busy} onClick={save}>Save</button>
        {saved && <span className="text-[14px] font-bold text-forest">Saved.</span>}
      </div>
    </div>
  );
}

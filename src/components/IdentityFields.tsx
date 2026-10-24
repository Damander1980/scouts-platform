"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { Field } from "@/components/ui";

// Preferred name, pronouns, the gender on the Scouting America registration, and a private housing note.
// Used at sign-up, when adding a child, and on the Family page. Gender is never used to block or sort anyone.
export type Identity = { nickname: string; pronouns: string; gender: "" | "male" | "female"; note: string };
export const EMPTY_IDENTITY: Identity = { nickname: "", pronouns: "", gender: "", note: "" };

export function IdentityFields({ value, onChange, youth = true, compact = false }: {
  value: Identity; onChange: (v: Identity) => void; youth?: boolean; compact?: boolean;
}) {
  const set = (k: keyof Identity) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className={`grid gap-3 ${compact ? "" : "sm:grid-cols-2"}`}>
      <Field label="Goes by (optional)" hint="The name to use day to day, if different.">
        <input className="input" value={value.nickname} onChange={set("nickname")} maxLength={40} />
      </Field>
      <Field label="Pronouns (optional)" hint="Shown to the troop next to the name.">
        <input className="input" list="pronoun-options" value={value.pronouns} onChange={set("pronouns")} maxLength={40} placeholder="e.g. she/her" />
        <datalist id="pronoun-options">
          <option value="he/him" /><option value="she/her" /><option value="they/them" />
        </datalist>
      </Field>
      <Field label="Gender on Scouting America registration" hint={youth
        ? "Troops are registered as boy or girl troops, so Scoutbook needs this. Private: only your family and trained leaders see it."
        : "Matches your Scouting America registration. Private: only your family and trained leaders see it."}>
        <select className="input" value={value.gender} onChange={set("gender")}>
          <option value="">Not set</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </Field>
      <Field label="Anything leaders should know for tents or cabins? (optional)" hint="Private. For campouts and summer camp planning.">
        <textarea className="input min-h-[44px]" rows={2} value={value.note} onChange={set("note")} maxLength={500} />
      </Field>
    </div>
  );
}

export const hasIdentity = (v: Identity) => !!(v.nickname.trim() || v.pronouns.trim() || v.gender || v.note.trim());

// Saves the fields; quietly does nothing if the database hasn't been updated yet (migration 0071).
export async function saveIdentity(supabase: SupabaseClient, orgId: string | null, personId: string, v: Identity) {
  const { error } = await supabase.rpc("set_person_identity", {
    p_org: orgId, p_person: personId, p_nickname: v.nickname, p_pronouns: v.pronouns, p_gender: v.gender || null, p_note: v.note,
  });
  if (error && error.code !== "PGRST202") throw error;
}

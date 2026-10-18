"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const UNIT_TYPES = [
  { id: "scouts_bsa", name: "Scouts BSA", sub: "Ages 11–17", word: "Troop", hasScoutbook: true,
    icon: "M2 20 12 4l10 16zM12 4v16" },
  { id: "cubs", name: "Cub Scouts", sub: "Grades K–5", word: "Pack", hasScoutbook: true,
    icon: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.2 6.5 20.2l1-6.2L3 9.6l6.2-.9z" },
  { id: "venturing", name: "Venturing crew", sub: "Ages 14–20", word: "Crew", hasScoutbook: true,
    icon: "M3 20l6-10 4 6 3-4 5 8z" },
  { id: "sea", name: "Sea Scouts", sub: "Ages 14–20", word: "Ship", hasScoutbook: true,
    icon: "M12 3a2 2 0 100 4 2 2 0 000-4zM12 7v14M5 13a7 7 0 0014 0M8 11h8" },
  { id: "trail_life", name: "Trail Life USA", sub: "Faith-based alternative", word: "Troop", hasScoutbook: false,
    icon: "M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" },
  { id: "ahg", name: "American Heritage Girls", sub: "Christ-centered program for girls", word: "Troop", hasScoutbook: false,
    icon: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.2 6.5 20.2l1-6.2L3 9.6l6.2-.9z" },
  { id: "other", name: "Other youth group", sub: "Clubs, teams, any program", word: "Group", hasScoutbook: false,
    icon: "M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 11a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM16 14c3 0 5 1.7 5 5" },
];

function makeSlug(word: string, number: string, city: string) {
  return word + number.replace(/[^A-Za-z0-9]/g, "") + city.replace(/[^A-Za-z0-9]/g, "");
}

export default function SetupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(1);
  const [unitId, setUnitId] = useState("scouts_bsa");
  const [number, setNumber] = useState("");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const unit = UNIT_TYPES.find((u) => u.id === unitId)!;
  const slug = makeSlug(unit.word, number, city);

  async function finish() {
    setSaving(true);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      // Create org
      const { data: org, error: orgErr } = await supabase
        .from("organizations")
        .insert({
          name: `${unit.word} ${number} ${city}`.trim(),
          type: unitId,
          unit_number: number,
          city,
          slug: slug.toLowerCase(),
        })
        .select()
        .single();
      if (orgErr) throw orgErr;

      // Ensure person record exists for this user
      let { data: person } = await supabase
        .from("persons")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!person) {
        const meta = user.user_metadata;
        const { data: newPerson, error: pErr } = await supabase
          .from("persons")
          .insert({
            user_id: user.id,
            first_name: meta?.full_name?.split(" ")[0] ?? "Leader",
            last_name: meta?.full_name?.split(" ").slice(1).join(" ") ?? "",
            type: "adult",
          })
          .select()
          .single();
        if (pErr) throw pErr;
        person = newPerson;
      }

      // Add membership as scoutmaster
      const { error: mErr } = await supabase
        .from("memberships")
        .insert({
          org_id: org.id,
          person_id: person!.id,
          role: "scoutmaster",
          status: "active",
        });
      if (mErr) throw mErr;

      router.push("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const headings: Record<number, string> = {
    1: "What kind of group?",
    2: `Name your ${unit.word.toLowerCase()}`,
    3: "Bring your data",
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col max-w-sm mx-auto">
      {/* Header */}
      <div className="bg-forest text-white px-5 pt-6 pb-6 flex flex-col gap-2">
        <span className="text-xs font-bold tracking-widest uppercase text-mist-dark">
          Step {step} of 3
        </span>
        <h1 className="font-display font-extrabold text-[30px] leading-tight">
          {headings[step]}
        </h1>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">

        {step === 1 && (
          <>
            <p className="text-sm text-smoke">
              Pick your youth program. Everything else adapts to it.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {UNIT_TYPES.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  aria-pressed={u.id === unitId}
                  onClick={() => setUnitId(u.id)}
                  className="min-h-[112px] rounded-2xl p-3.5 flex flex-col items-start justify-between text-left font-sans transition-colors"
                  style={{
                    background: u.id === unitId ? "#EAF0ED" : "#FFFFFF",
                    border: `2px solid ${u.id === unitId ? "#1F5F4A" : "#D5DFDA"}`,
                  }}
                >
                  <span className="text-forest">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d={u.icon} />
                    </svg>
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="font-bold text-base leading-tight">{u.name}</span>
                    <span className="text-xs text-smoke leading-snug">{u.sub}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="num" className="font-bold text-sm">{unit.word} number</label>
              <input
                id="num"
                type="text"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="999"
                className="input w-full"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="city" className="font-bold text-sm">City</label>
              <input
                id="city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Plano"
                className="input w-full"
              />
            </div>
            {(number || city) && (
              <div className="card flex flex-col gap-1.5">
                <span className="text-xs font-bold tracking-widest uppercase text-smoke">
                  Your page address
                </span>
                <span className="font-display font-bold text-xl break-all">
                  scoutplatform.app/{slug.toLowerCase()}
                </span>
                <span className="text-sm text-smoke">
                  Free with your plan. Families come here to RSVP and pay.
                </span>
              </div>
            )}
          </>
        )}

        {step === 3 && (
          <>
            {unit.hasScoutbook ? (
              <>
                <p className="text-sm text-smoke">
                  Bring your members, ranks and merit badges. Nothing typed twice.
                </p>
                <div className="card flex flex-col gap-3">
                  <span className="font-bold text-[17px]">Upload your Scoutbook export</span>
                  <span className="text-sm text-smoke leading-relaxed">
                    Export from Scoutbook Plus: roster report, scout advancement, activity log. Then add them here.
                  </span>
                  <button type="button" className="btn-primary">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
                    </svg>
                    Choose files
                  </button>
                  <span className="text-xs text-smoke">
                    We never ask for your Scoutbook password.
                  </span>
                </div>
                <div className="card flex flex-col gap-3">
                  <span className="font-bold text-base">Or start from a spreadsheet</span>
                  <button type="button" className="btn-secondary">Upload a CSV</button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-smoke leading-relaxed">
                  Scoutbook import is for Scouting America units. For {unit.name}, you build your own ranks and awards — we keep the rest of the setup the same.
                </p>
                <div className="card flex flex-col gap-3">
                  <span className="font-bold text-[17px]">Start from a spreadsheet</span>
                  <span className="text-sm text-smoke leading-relaxed">
                    Upload your roster as a CSV. Ranks and badges are set up in the next step with a checklist builder.
                  </span>
                  <button type="button" className="btn-primary">Upload a CSV</button>
                </div>
              </>
            )}
            {error && <p className="text-sm text-orange-dark">{error}</p>}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-border px-4 pt-3 pb-5 flex gap-3">
        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="btn-secondary"
          >
            Back
          </button>
        )}
        {step < 3 && (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={step === 2 && (!number || !city)}
            className="btn-primary flex-1 disabled:opacity-40"
          >
            Continue
          </button>
        )}
        {step === 3 && (
          <button
            type="button"
            onClick={finish}
            disabled={saving}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {saving ? "Creating…" : `Create ${unit.word.toLowerCase()} now`}
          </button>
        )}
      </div>
    </div>
  );
}

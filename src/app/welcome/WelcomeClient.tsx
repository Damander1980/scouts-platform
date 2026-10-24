"use client";

import { useState } from "react";
import Mark from "@/components/Mark";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ErrorBox, Field, ageFrom } from "@/components/ui";
import { childLoginConsent } from "@/app/family/ChildLogin";
import { EMPTY_IDENTITY, IdentityFields, hasIdentity, saveIdentity, type Identity } from "@/components/IdentityFields";

export type FamilyPerson = { id: string; first_name: string; last_name: string; type: string; birthdate: string | null };
export type PendingJoin = { id: string; org_name: string; created_at: string };
type FoundOrg = { id: string; name: string; type: string; city: string | null; state: string | null };

const age = ageFrom;

export default function WelcomeClient({ initialStep, person, family: initialFamily, pending, hasTroop, inviteCode }: {
  initialStep: "name" | "family" | "troop";
  person: { id: string; first_name: string; last_name: string } | null;
  family: FamilyPerson[]; pending: PendingJoin[]; hasTroop: boolean; inviteCode: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [step, setStep] = useState(initialStep);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [first, setFirst] = useState(person?.first_name && person.first_name !== "New" ? person.first_name : "");
  const [last, setLast] = useState(person?.last_name ?? "");

  const [family, setFamily] = useState(initialFamily);
  const [kidFirst, setKidFirst] = useState("");
  const [kidLast, setKidLast] = useState(person?.last_name ?? "");
  const [kidBirth, setKidBirth] = useState("");
  const [meId, setMeId] = useState<Identity>(EMPTY_IDENTITY);
  const [kidId, setKidId] = useState<Identity>(EMPTY_IDENTITY);
  const [kidEmail, setKidEmail] = useState("");
  const [kidConsent, setKidConsent] = useState(false);
  const [familyCode, setFamilyCode] = useState("");
  const [claimCode, setClaimCode] = useState("");

  const [code, setCode] = useState(inviteCode);
  const [found, setFound] = useState<FoundOrg | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [requested, setRequested] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await fn(); } catch (e: any) { setError(e.message ?? String(e)); }
    setBusy(false);
  };

  const reloadFamily = async () => {
    const { data: me } = await supabase.rpc("my_family");
    setFamily((me ?? []) as FamilyPerson[]);
  };

  const saveName = () => run(async () => {
    const { data: myId, error } = await supabase.rpc("ensure_person", { p_first: first, p_last: last });
    if (error) throw error;
    if (myId && hasIdentity(meId)) await saveIdentity(supabase, null, myId as string, meId);
    if (!kidLast) setKidLast(last);
    await reloadFamily();
    setStep("family");
  });

  const addKid = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const { data: newKid, error } = await supabase.rpc("add_child", { p_first: kidFirst, p_last: kidLast, p_birthdate: kidBirth || null });
      if (error) throw error;
      // The child exists now: clear the form and show them even if a follow-up step fails, so "Add child" isn't pressed twice.
      const name = kidFirst, ident = kidId, email = kidEmail.trim();
      setKidFirst(""); setKidBirth(""); setKidId(EMPTY_IDENTITY); setKidEmail(""); setKidConsent(false);
      try {
        if (newKid && hasIdentity(ident)) await saveIdentity(supabase, null, newKid as string, ident);
        // Optional: the child's own email becomes their own login once the parent consents.
        if (newKid && email) {
          const { error: le } = await supabase.rpc("invite_child_login", { p_person: newKid, p_email: email, p_consent_text: childLoginConsent(name) });
          if (le) throw new Error(`${name} was added, but their login wasn't set up: ${le.message}. You can do it later on your Family page.`);
        }
      } finally {
        await reloadFamily();
      }
    });
  };

  const joinFamily = () => run(async () => {
    const { data, error } = await supabase.rpc("accept_household_invite", { p_code: familyCode });
    if (error) throw error;
    if (!data) throw new Error("That family code didn't work. It may have expired (codes last 14 days) or been used already. Ask for a new one.");
    setFamilyCode("");
    await reloadFamily();
  });

  const findOrg = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const { data, error } = await supabase.rpc("lookup_org", { p_code: code });
      if (error) throw error;
      const org = (data as FoundOrg[])?.[0];
      if (!org) throw new Error("No troop found with that code. Check with your leader.");
      setFound(org);
      setChosen(family.map((f) => f.id));
    });
  };

  const requestJoin = () => run(async () => {
    if (!found) return;
    if (!chosen.length) throw new Error("Pick at least one person to join.");
    const { error } = await supabase.rpc("request_join", { p_org: found.id, p_person_ids: chosen, p_note: null });
    if (error) throw error;
    setRequested(true);
  });

  const header = {
    name: { kicker: "Welcome", title: "First, who are you?" },
    family: { kicker: "Step 2", title: "Your family" },
    troop: { kicker: "Step 3", title: "Your troop" },
  }[step];

  return (
    <div className="min-h-screen bg-canvas flex flex-col sm:py-10">
      <div className="w-full max-w-xl mx-auto bg-forest text-white px-6 pt-10 pb-7 sm:rounded-[20px]"
        style={{ boxShadow: "0 2px 4px rgba(16,27,45,.08), 0 14px 32px rgba(16,27,45,.18)" }}>
        <div className="flex items-center gap-2.5 mb-5">
          <Mark size={32} />
          <span className="font-display font-extrabold text-[17px]">Our Troop Manager</span>
        </div>
        <div className="eyebrow" style={{ color: "#F5B700" }}>{header.kicker}</div>
        <h1 className="font-display font-extrabold text-[32px] leading-tight m-0 mt-1">{header.title}</h1>
      </div>

      <div className="flex-1 w-full max-w-xl mx-auto px-4 sm:px-0 py-6 flex flex-col gap-5">
        <ErrorBox>{error}</ErrorBox>

        {step === "name" && (
          <form onSubmit={(e) => { e.preventDefault(); saveName(); }} className="flex flex-col gap-4">
            <p className="text-[15px] text-smoke m-0">Parents and leaders: use your own name. You will add your kids next.</p>
            <Field label="First name"><input className="input" value={first} onChange={(e) => setFirst(e.target.value)} required autoFocus autoComplete="given-name" /></Field>
            <Field label="Last name"><input className="input" value={last} onChange={(e) => setLast(e.target.value)} required autoComplete="family-name" /></Field>
            <IdentityFields value={meId} onChange={setMeId} youth={false} compact />
            <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Continue"}</button>
          </form>
        )}

        {step === "family" && (
          <>
            <div className="card flex flex-col gap-2">
              <div className="font-bold text-[15px]">In your family</div>
              {family.map((f) => (
                <div key={f.id} className="flex items-center gap-3 py-1.5">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-[13px]"
                    style={{ background: f.type === "youth" ? "#12355F" : "#4B5568" }}>
                    {f.first_name[0]}{f.last_name[0] ?? ""}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-[15px]">{f.first_name} {f.last_name}</div>
                    <div className="text-[13px] text-smoke">{f.type === "youth" ? `Youth${age(f.birthdate) !== null ? ` · age ${age(f.birthdate)}` : ""}` : "Adult"}</div>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={addKid} className="card flex flex-col gap-3">
              <div className="font-bold text-[15px]">Add a child</div>
              <p className="text-[13px] text-smoke m-0">Add each child in your family. A child with their own email gets their own login; without one, you handle everything from your account. Parents still handle payments and permission.</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="First name"><input className="input" value={kidFirst} onChange={(e) => setKidFirst(e.target.value)} required /></Field>
                <Field label="Last name"><input className="input" value={kidLast} onChange={(e) => setKidLast(e.target.value)} required /></Field>
              </div>
              <Field label="Birthday" hint="Used for rank age rules.">
                <input className="input" type="date" value={kidBirth} onChange={(e) => setKidBirth(e.target.value)} />
              </Field>
              <IdentityFields value={kidId} onChange={setKidId} />
              <Field label="Their own email (optional)" hint="If they have one, they get their own login for sign-ups, advancement and messages. No email is fine: you can do everything for them from your account.">
                <input className="input" type="email" value={kidEmail} onChange={(e) => { setKidEmail(e.target.value); if (!e.target.value) setKidConsent(false); }} autoComplete="off" />
              </Field>
              {kidEmail.trim() && (
                <label className="flex items-start gap-3 text-[13px]">
                  <input type="checkbox" className="w-5 h-5 mt-0.5 flex-none" checked={kidConsent} onChange={(e) => setKidConsent(e.target.checked)} required />
                  <span>{childLoginConsent(kidFirst || "my child")}</span>
                </label>
              )}
              <button className="btn-secondary" disabled={busy || (!!kidEmail.trim() && !kidConsent)}>Add child</button>
            </form>

            <details className="card">
              <summary className="font-bold text-[15px] cursor-pointer">Did your leader give you a claim code?</summary>
              <div className="flex flex-col gap-3 mt-3">
                <p className="text-[13px] text-smoke m-0">Use it if your troop already added your family. You will be linked to your existing record.</p>
                <div className="flex gap-2">
                  <input aria-label="Claim code" className="input flex-1" value={claimCode} onChange={(e) => setClaimCode(e.target.value)} placeholder="Claim code" />
                  <button type="button" className="btn-secondary" disabled={busy || !claimCode} onClick={() => run(async () => {
                    const { data, error } = await supabase.rpc("claim_record", { p_code: claimCode });
                    if (error) throw error;
                    if (!data) throw new Error("That claim code didn't work. It may have expired (codes last 14 days) or been used already. Ask your leader for a new one.");
                    setClaimCode("");
                    router.push("/home");
                  })}>Claim</button>
                </div>
              </div>
            </details>

            <details className="card">
              <summary className="font-bold text-[15px] cursor-pointer">Joining your spouse or co-parent&apos;s family?</summary>
              <div className="flex flex-col gap-3 mt-3">
                <p className="text-[13px] text-smoke m-0">Ask them for a family code from their Family page.</p>
                <div className="flex gap-2">
                  <input aria-label="Family code" className="input flex-1" value={familyCode} onChange={(e) => setFamilyCode(e.target.value)} placeholder="Family code" />
                  <button type="button" className="btn-secondary" onClick={joinFamily} disabled={busy || !familyCode}>Join</button>
                </div>
              </div>
            </details>

            {/* An invite link still goes on to the troop step for someone already in another troop. */}
            <button className="btn-primary" onClick={() => (hasTroop && !inviteCode ? router.push("/dashboard") : setStep("troop"))}>
              {hasTroop && !inviteCode ? "Done" : "Continue"}
            </button>
          </>
        )}

        {step === "troop" && (
          <>
            {pending.length > 0 && !requested && (
              <div className="card" style={{ background: "#FFF6D6", borderColor: "#F0DA8C" }}>
                <div className="font-bold text-[15px]">Waiting for approval</div>
                <p className="text-[14px] m-0 mt-1">A leader from {pending.map((p) => p.org_name).join(", ")} will approve your request soon.</p>
              </div>
            )}

            {requested ? (
              <div className="card text-center flex flex-col gap-2 py-8">
                <div className="font-display font-bold text-[22px]">Request sent</div>
                <p className="text-[15px] text-smoke m-0">A leader of {found?.name} will approve you. You will get access as soon as they do.</p>
              </div>
            ) : found ? (
              <div className="card flex flex-col gap-3">
                <div>
                  <div className="eyebrow text-smoke">Joining</div>
                  <div className="font-display font-bold text-[22px]">{found.name}</div>
                  <div className="text-[14px] text-smoke">{[found.city, found.state].filter(Boolean).join(", ")}</div>
                </div>
                <div className="font-bold text-[14px]">Who is joining?</div>
                {family.map((f) => (
                  <label key={f.id} className="flex items-center gap-3 py-1 text-[15px]">
                    <input type="checkbox" className="w-5 h-5" checked={chosen.includes(f.id)}
                      onChange={(e) => setChosen(e.target.checked ? [...chosen, f.id] : chosen.filter((x) => x !== f.id))} />
                    {f.first_name} {f.last_name} <span className="text-smoke text-[13px]">{f.type === "youth" ? "Youth" : "Adult"}</span>
                  </label>
                ))}
                <button className="btn-primary" onClick={requestJoin} disabled={busy}>Request to join</button>
                <button className="btn-ghost" onClick={() => setFound(null)}>Use a different code</button>
              </div>
            ) : (
              <form onSubmit={findOrg} className="card flex flex-col gap-3">
                <div className="font-bold text-[17px]">Join with a code</div>
                <p className="text-[14px] text-smoke m-0">Your leader can share the troop&apos;s join code or page address.</p>
                <input aria-label="e.g. 4f2a9c1e or troop999plano" className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 4f2a9c1e or troop999plano" required />
                <button className="btn-primary" disabled={busy}>Find troop</button>
              </form>
            )}

            {!requested && (
              <div className="card flex flex-col gap-2">
                <div className="font-bold text-[17px]">Starting a new troop?</div>
                <p className="text-[14px] text-smoke m-0">Set it up yourself. You become its first admin.</p>
                <a href="/setup" className="btn-secondary no-underline">Start a troop</a>
              </div>
            )}

            <button className="btn-ghost" onClick={() => setStep("family")}>Back to family</button>
          </>
        )}
      </div>
    </div>
  );
}

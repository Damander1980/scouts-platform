"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ErrorBox, Field, fmtDate } from "@/components/ui";

const SMS_CONSENT =
  "I agree to receive text messages from Our Troop Manager about my unit's events, deadlines, payments and urgent changes at the number above. " +
  "Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help. Consent is not required to use the service.";

const CATS: [string, string][] = [
  ["reminders", "Event reminders"], ["deadlines", "RSVP deadlines"], ["payments", "Payments and balances"],
  ["messages", "Messages from leaders"], ["digest", "Weekly digest"], ["urgent", "Urgent changes (weather, cancellations)"],
];

type Prefs = {
  email_on: boolean; push_on: boolean; sms_on: boolean; sms_phone: string | null; sms_consent_at: string | null;
  categories: Record<string, boolean>; quiet_start: string; quiet_end: string; digest_day: string; timezone: string;
};

export default function SettingsClient({ person, email, prefs, weekCount }: {
  person: { id: string; first_name: string; last_name: string }; email: string; prefs: Prefs | null; weekCount: number;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [first, setFirst] = useState(person.first_name);
  const [last, setLast] = useState(person.last_name);
  const [p, setP] = useState<Prefs>(prefs ?? {
    email_on: true, push_on: true, sms_on: false, sms_phone: "", sms_consent_at: null,
    categories: Object.fromEntries(CATS.map(([k]) => [k, true])), quiet_start: "21:00", quiet_end: "08:00",
    digest_day: "sun", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const [agree, setAgree] = useState(false);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");

  const [saving, setSaving] = useState(false);
  async function save() {
    if (saving) return;
    setSaving(true);
    try { await saveInner(); } finally { setSaving(false); }
  }
  async function saveInner() {
    setError(""); setSaved("");
    if (p.sms_on && !p.sms_consent_at && !agree) { setError("Check the box to agree to texts first."); return; }
    if (p.sms_on && !/^\+?[0-9 ()-]{10,}$/.test(p.sms_phone ?? "")) { setError("Enter a valid mobile number for texts."); return; }
    const consentNow = p.sms_on && !p.sms_consent_at && agree;
    const row = {
      person_id: person.id, email_on: p.email_on, push_on: p.push_on, sms_on: p.sms_on,
      sms_phone: p.sms_on ? p.sms_phone : null, categories: p.categories,
      quiet_start: p.quiet_start, quiet_end: p.quiet_end, digest_day: p.digest_day, timezone: p.timezone,
      updated_at: new Date().toISOString(),
      ...(consentNow ? { sms_consent_at: new Date().toISOString(), sms_consent_text: SMS_CONSENT } : {}),
      ...(!p.sms_on ? { sms_consent_at: null } : {}),
    };
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("notification_prefs").upsert(row),
      supabase.from("persons").update({ first_name: first.trim(), last_name: last.trim() }).eq("id", person.id),
    ]);
    if (e1 || e2) setError((e1 || e2)!.message);
    else {
      setSaved("Saved.");
      if (consentNow) { setP({ ...p, sms_consent_at: row.sms_consent_at! }); fetch("/api/sms/confirm", { method: "POST" }).catch(() => {}); }
      // Turning texts off cleared the saved consent, so turning them back on must ask for it again.
      else if (!p.sms_on && p.sms_consent_at) { setP({ ...p, sms_consent_at: null }); setAgree(false); }
      router.refresh();
    }
  }

  const toggle = (k: keyof Prefs) => setP({ ...p, [k]: !p[k] });

  return (
    <div className="flex flex-col gap-5">
      <ErrorBox>{error}</ErrorBox>
      {saved && <div className="card font-bold" style={{ background: "#EEE8D9" }}>{saved}</div>}
      <div className="grid gap-5 lg:grid-cols-2 items-start">

      <section className="card flex flex-col gap-3">
        <div className="font-bold text-[16px]">You</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name"><input className="input" value={first} onChange={(e) => setFirst(e.target.value)} /></Field>
          <Field label="Last name"><input className="input" value={last} onChange={(e) => setLast(e.target.value)} /></Field>
        </div>
        <div className="text-[14px] text-smoke">Signed in as {email}</div>
      </section>

      <section className="card flex flex-col gap-3">
        <div className="font-bold text-[16px]">Where to reach you</div>
        <div className="text-[13px] text-smoke">{weekCount} notices sent to you this week. Alerts never include message content, only a link.</div>
        <label className="flex items-center gap-3 text-[15px]"><input type="checkbox" className="w-5 h-5" checked={p.email_on} onChange={() => toggle("email_on")} /> Email</label>
        <label className="flex items-center gap-3 text-[15px]"><input type="checkbox" className="w-5 h-5" checked={p.push_on} onChange={() => toggle("push_on")} /> Phone notifications (after you install the app)</label>
        <label className="flex items-center gap-3 text-[15px]"><input type="checkbox" className="w-5 h-5" checked={p.sms_on} onChange={() => toggle("sms_on")} /> Text messages</label>
        {p.sms_on && (
          <div className="flex flex-col gap-2 pl-8">
            <input aria-label="Mobile number" className="input" type="tel" placeholder="Mobile number" value={p.sms_phone ?? ""} onChange={(e) => setP({ ...p, sms_phone: e.target.value })} />
            {p.sms_consent_at ? (
              <div className="text-[13px] text-smoke">You agreed to texts on {fmtDate(p.sms_consent_at, { month: "short", day: "numeric", year: "numeric" })}. Turn off anytime, or reply STOP.</div>
            ) : (
              <label className="flex items-start gap-3 text-[13px]">
                <input type="checkbox" className="w-5 h-5 mt-0.5 flex-none" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>{SMS_CONSENT}</span>
              </label>
            )}
          </div>
        )}
      </section>

      <section className="card flex flex-col gap-3">
        <div className="font-bold text-[16px]">What to send</div>
        {CATS.map(([k, label]) => (
          <label key={k} className="flex items-center gap-3 text-[15px]">
            <input type="checkbox" className="w-5 h-5" checked={p.categories[k] !== false}
              onChange={(e) => setP({ ...p, categories: { ...p.categories, [k]: e.target.checked } })} /> {label}
          </label>
        ))}
      </section>

      <section className="card flex flex-col gap-3">
        <div className="font-bold text-[16px]">Quiet hours</div>
        <p className="text-[13px] text-smoke m-0">No alerts during these hours, except urgent changes you opted into.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From"><input className="input" type="time" value={p.quiet_start.slice(0, 5)} onChange={(e) => setP({ ...p, quiet_start: e.target.value })} /></Field>
          <Field label="Until"><input className="input" type="time" value={p.quiet_end.slice(0, 5)} onChange={(e) => setP({ ...p, quiet_end: e.target.value })} /></Field>
        </div>
        <Field label="Weekly digest day">
          <select className="input" value={p.digest_day} onChange={(e) => setP({ ...p, digest_day: e.target.value })}>
            {["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((d) => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>)}
          </select>
        </Field>
      </section>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
      <button className="btn-primary px-10" disabled={saving} onClick={save}>{saving ? "Saving..." : "Save settings"}</button>
      <a href="/settings/privacy" className="btn-secondary no-underline">Privacy & data (request deletion)</a>
      <button className="btn-ghost" onClick={async () => { navigator.serviceWorker?.controller?.postMessage("clear-private"); await supabase.auth.signOut(); window.location.href = "/login"; }}>Sign out</button>
      </div>
    </div>
  );
}

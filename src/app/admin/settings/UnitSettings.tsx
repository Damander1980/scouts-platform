"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ErrorBox, Field } from "@/components/ui";

type Org = { id: string; name: string; unit_number: string | null; city: string | null; state: string | null; settings: Record<string, unknown>; second_approval_cents: number; slug: string };

export default function UnitSettings({ org, isAdmin, calendarToken }: { org: Org; isAdmin: boolean; calendarToken: string }) {
  const supabase = createClient();
  const router = useRouter();
  const st = org.settings ?? {};
  const [f, setF] = useState({
    name: org.name, city: org.city ?? "", state: org.state ?? "",
    email_mode: (st.email_mode as string) ?? "full",
    scout_rsvp: (st.scout_rsvp as string) ?? "parent_approves_paid",
    leaderboard: !!st.fundraising_leaderboard,
    contact_default: (st.contact_default as string) ?? "opt_in",
    payment_methods: (st.payment_methods as string) ?? "both",
    card_fee_payer: (st.card_fee_payer as string) ?? "family",
    block_owing: st.block_owing_cents != null && st.block_owing_cents !== "" ? String(Number(st.block_owing_cents) / 100) : "",
    second: String(org.second_approval_cents / 100),
  });
  const [ok, setOk] = useState("");
  const [error, setError] = useState("");
  const [token, setToken] = useState(calendarToken);

  async function save() {
    setOk(""); setError("");
    const { error } = await supabase.from("organizations").update({
      name: f.name, city: f.city, state: f.state || null, second_approval_cents: Math.round(parseFloat(f.second || "500") * 100),
      settings: { ...st, email_mode: f.email_mode, scout_rsvp: f.scout_rsvp, fundraising_leaderboard: f.leaderboard, contact_default: f.contact_default, payment_methods: f.payment_methods, card_fee_payer: f.card_fee_payer,
        block_owing_cents: f.block_owing.trim() === "" ? null : Math.round(parseFloat(f.block_owing) * 100) },
    }).eq("id", org.id);
    if (error) setError(error.message); else { setOk("Saved."); router.refresh(); }
  }

  // Same host as the Events page's "Add to my calendar" link, so admins and families see one URL.
  // NEXT_PUBLIC_ vars are baked in at build time, so server and browser render identical HTML.
  const feed = `webcal://${process.env.NEXT_PUBLIC_SITE_HOST ?? "localhost:3000"}/api/calendar/${org.id}?t=${token}`;

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div><h1 className="font-display font-extrabold text-[32px] m-0">Unit settings</h1></div>
      {!isAdmin && <div className="card">Only unit admins can change settings.</div>}
      <ErrorBox>{error}</ErrorBox>
      {ok && <div className="card font-bold" style={{ background: "#EEE8D9" }}>{ok}</div>}

      <section className="card grid sm:grid-cols-3 gap-3">
        <Field label="Unit name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="City"><input className="input" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
        <Field label="State"><input className="input" maxLength={2} value={f.state} onChange={(e) => setF({ ...f, state: e.target.value.toUpperCase() })} /></Field>
      </section>

      <section className="card flex flex-col gap-3">
        <div className="font-bold text-[16px]">Email from leaders</div>
        <label className="flex gap-3 items-start text-[14px]"><input type="radio" checked={f.email_mode === "full"} onChange={() => setF({ ...f, email_mode: "full" })} className="mt-1" />
          <span><b>Full message in the email</b> (like TroopWebHost). Families read it in their inbox and can reply-all.</span></label>
        <label className="flex gap-3 items-start text-[14px]"><input type="radio" checked={f.email_mode === "notice"} onChange={() => setF({ ...f, email_mode: "notice" })} className="mt-1" />
          <span><b>Notice only</b>: the email says a message is waiting, and families read it in the app. Most private.</span></label>
      </section>

      <section className="card flex flex-col gap-3">
        <div className="font-bold text-[16px]">Scouts and families</div>
        <Field label="When a Scout with a login RSVPs">
          <select className="input" value={f.scout_rsvp} onChange={(e) => setF({ ...f, scout_rsvp: e.target.value })}>
            <option value="parent_approves_paid">Scout RSVPs; a parent approves anything that costs money</option>
            <option value="scout_final">Scout&apos;s RSVP is final</option>
            <option value="parent_only">Only parents can RSVP</option>
          </select>
        </Field>
        <Field label="Family contact info on the member roster">
          <select className="input" value={f.contact_default} onChange={(e) => setF({ ...f, contact_default: e.target.value })}>
            <option value="opt_in">Hidden unless a family opts in (recommended)</option>
            <option value="opt_out">Shown unless a family opts out</option>
          </select>
        </Field>
      </section>

      <section className="card flex flex-col gap-3">
        <div className="font-bold text-[16px]">Money</div>
        <Field label="How families can pay">
          <select className="input" value={f.payment_methods} onChange={(e) => setF({ ...f, payment_methods: e.target.value })}>
            <option value="both">Card online, or cash and check in person</option>
            <option value="card">Card online only</option>
            <option value="cash">Cash and check only</option>
          </select>
        </Field>
        {f.payment_methods !== "cash" && (
          <Field label="Who pays the card fee (about 2.9% + 30¢)">
            <select className="input" value={f.card_fee_payer} onChange={(e) => setF({ ...f, card_fee_payer: e.target.value })}>
              <option value="family">Families, added at checkout (the unit receives the full amount)</option>
              <option value="unit">The unit absorbs it (families pay the exact amount)</option>
            </select>
          </Field>
        )}
        <Field label="Block new sign-ups when a family owes more than ($)" hint="Leave blank to never block. Leaders can still add anyone.">
          <input className="input w-40" inputMode="decimal" value={f.block_owing} onChange={(e) => setF({ ...f, block_owing: e.target.value })} placeholder="Never" />
        </Field>
        <Field label="Reimbursements over this amount need a second approver ($)"><input className="input w-40" inputMode="decimal" value={f.second} onChange={(e) => setF({ ...f, second: e.target.value })} /></Field>
        <label className="flex items-center gap-3 text-[14px]"><input type="checkbox" className="w-5 h-5" checked={f.leaderboard} onChange={(e) => setF({ ...f, leaderboard: e.target.checked })} /> Show a fundraising leaderboard of individual Scouts</label>
      </section>

      <section className="card flex flex-col gap-2">
        <div className="font-bold text-[16px]">Calendar feed</div>
        <p className="text-[13px] text-smoke m-0">Families add this to Google or Apple Calendar from the Events page. If the link leaks, make a new one.</p>
        <code className="text-[12px] break-all bg-paper rounded-lg p-2">{feed}</code>
        {isAdmin && <button className="btn-secondary self-start" onClick={async () => {
          const { data, error } = await supabase.rpc("rotate_calendar_token", { p_org: org.id });
          if (error) setError(error.message); else setToken(String(data));
        }}>Make a new link</button>}
      </section>

      <button className="btn-primary self-start" disabled={!isAdmin} onClick={save}>Save settings</button>
    </div>
  );
}

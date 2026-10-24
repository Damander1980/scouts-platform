"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ErrorBox, Field, toZonedInput, fromZonedInput } from "@/components/ui";

export type EventInput = {
  id?: string; title: string; description: string | null; location: string | null; kind: string;
  start_at: string; end_at: string | null; cost_cents: number; cap: number | null; rsvp_deadline: string | null;
  refund_rule: string; visibility: string; needs_permission: boolean; share_linked?: boolean; overnight_nights: number;
  service_hours: number; miles: number; questions: string[];
};

// Times are entered in the troop's time zone, not the device's (a leader traveling still schedules Plano time).
const toLocal = toZonedInput;
const fromLocal = fromZonedInput;

const KINDS = [
  ["meeting", "Troop meeting"], ["campout", "Campout"], ["service", "Service project"],
  ["fundraiser", "Fundraiser"], ["high_adventure", "High adventure / summer camp"], ["event", "Other event"],
];

export default function EventForm({ orgId, initial, copyFrom }: { orgId: string; initial?: EventInput; copyFrom?: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [f, setF] = useState({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    location: initial?.location ?? "",
    kind: initial?.kind ?? "campout",
    start: toLocal(initial?.start_at ?? null),
    end: toLocal(initial?.end_at ?? null),
    cost: initial ? String(initial.cost_cents / 100) : "",
    cap: initial?.cap ? String(initial.cap) : "",
    deadline: toLocal(initial?.rsvp_deadline ?? null),
    refund: initial?.refund_rule ?? "full",
    visibility: initial?.visibility ?? "members",
    permission: initial?.needs_permission ?? false,
    shareLinked: initial?.share_linked ?? false,
    nights: initial ? String(initial.overnight_nights) : "",
    hours: initial ? String(initial.service_hours) : "",
    miles: initial ? String(initial.miles) : "",
    questions: (initial?.questions ?? []).join("\n"),
    repeatUntil: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });

  const autoNights = () => {
    if (!f.start || !f.end) return 0;
    const a = new Date(f.start), b = new Date(f.end);
    return Math.max(0, Math.round((new Date(b.toDateString()).getTime() - new Date(a.toDateString()).getTime()) / 86400000));
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    let createdId: string | null = null;
    try {
      if (f.end && f.start && new Date(f.end) < new Date(f.start)) throw new Error("The end must be after the start.");
      if (!initial?.id && f.kind === "meeting" && f.repeatUntil) {
        const minutes = f.end ? Math.round((new Date(f.end).getTime() - new Date(f.start).getTime()) / 60000) : 90;
        const base = {
          p_org: orgId, p_title: f.title.trim(), p_location: f.location.trim() || null,
          p_first: fromLocal(f.start), p_minutes: minutes, p_until: f.repeatUntil,
        };
        // Everything else on the form goes to every meeting in the series.
        const extra = {
          description: f.description.trim(), visibility: f.visibility, needs_permission: f.permission, share_linked: f.shareLinked,
          service_hours: parseFloat(f.hours || "0"), miles: parseFloat(f.miles || "0"),
          questions: f.questions.split("\n").map((q) => q.trim()).filter(Boolean),
          cost_cents: Math.round(parseFloat(f.cost || "0") * 100), cap: f.cap ? parseInt(f.cap) : null, refund_rule: f.refund,
        };
        let { error } = await supabase.rpc("create_weekly_series", { ...base, p_extra: extra });
        if (error?.code === "PGRST202") ({ error } = await supabase.rpc("create_weekly_series", base)); // database not yet updated (0069)
        if (error) throw error;
        router.push("/events");
        router.refresh();
        return;
      }
      const row = {
        org_id: orgId,
        title: f.title.trim(),
        description: f.description.trim() || null,
        location: f.location.trim() || null,
        kind: f.kind,
        start_at: fromLocal(f.start),
        end_at: fromLocal(f.end),
        cost_cents: Math.round(parseFloat(f.cost || "0") * 100),
        cap: f.cap ? parseInt(f.cap) : null,
        rsvp_deadline: fromLocal(f.deadline),
        refund_rule: f.refund,
        visibility: f.visibility,
        needs_permission: f.permission,
        share_linked: f.shareLinked,
        overnight_nights: f.nights ? parseInt(f.nights) : autoNights(),
        service_hours: parseFloat(f.hours || "0"),
        miles: parseFloat(f.miles || "0"),
        questions: f.questions.split("\n").map((q) => q.trim()).filter(Boolean),
      };
      // Charges post at sign-up, so a new price only applies to people who sign up after this.
      if (initial?.id && row.cost_cents !== initial.cost_cents
        && !window.confirm("Families who already signed up keep the price they were charged. Only new sign-ups pay the new price. Change it?")) { setBusy(false); return; }
      const { data, error } = initial?.id
        ? await supabase.from("events").update(row).eq("id", initial.id).select("id").single()
        : await supabase.from("events").insert(row).select("id").single();
      if (error) throw error;
      if (!initial?.id) createdId = data.id;
      // Editing the time or place of an event people signed up for: tell them.
      if (initial?.id) {
        const changed = [
          ...(row.start_at !== (initial.start_at ? new Date(initial.start_at).toISOString() : null) ? ["start"] : []),
          ...(row.end_at !== (initial.end_at ? new Date(initial.end_at).toISOString() : null) ? ["end"] : []),
          ...((row.location ?? "") !== (initial.location ?? "") ? ["location"] : []),
        ];
        // A raised (or removed) cap opens spots: move people up from the waitlist.
        if (row.cap !== initial.cap) {
          const { error: pe } = await supabase.rpc("promote_waitlist", { p_event: initial.id });
          if (pe && pe.code !== "PGRST202") throw pe; // PGRST202: database not yet updated (migration 0053)
        }
        if (changed.length) await fetch("/api/notify/change", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId: initial.id, changed }) }).catch(() => {});
      }
      // Copying an event brings its trip plan along, with every checkbox cleared for the new trip.
      if (!initial?.id && copyFrom) {
        const { data: plan, error: pErr } = await supabase.from("trip_plans").select("*").eq("event_id", copyFrom).maybeSingle();
        if (pErr) throw pErr;
        if (plan) {
          const clear = (xs: unknown) => (Array.isArray(xs) ? xs.map((x) => ({ ...x, done: false })) : xs);
          const { event_id: _e, updated_at: _u, ...rest } = plan as Record<string, unknown>;
          void _e; void _u;
          const { error: cErr } = await supabase.from("trip_plans").insert({ ...rest, event_id: data.id, org_id: orgId, tasks: clear(rest.tasks), permits: clear(rest.permits) });
          if (cErr) throw new Error(`The event was created, but its trip plan didn't copy: ${cErr.message}`);
        }
      }
      router.push(`/events/${data.id}`);
      router.refresh();
    } catch (e: any) {
      // The event itself was created: go to it rather than leave a form whose Save would make a second copy.
      if (createdId) { window.alert(`The event was saved, but: ${e.message}`); router.push(`/events/${createdId}`); router.refresh(); return; }
      setError(e.message);
    }
    setBusy(false);
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-5 max-w-2xl">
      <ErrorBox>{error}</ErrorBox>
      <div className="card flex flex-col gap-4">
      <div className="font-display font-extrabold text-[20px]">The basics</div>
      <Field label="What is it?"><input className="input" value={f.title} onChange={set("title")} required placeholder="Caprock Canyons campout" /></Field>
      <Field label="Type">
        <select className="input" value={f.kind} onChange={set("kind")}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Starts"><input className="input" type="datetime-local" value={f.start} onChange={set("start")} required /></Field>
        <Field label="Ends" hint="Multi-day trips show as one bar on the calendar."><input className="input" type="datetime-local" value={f.end} onChange={set("end")} /></Field>
      </div>
      {!initial?.id && f.kind === "meeting" && (
        <Field label="Repeat every week until (optional)" hint="Creates one meeting per week so attendance can be taken at each.">
          <input className="input" type="date" value={f.repeatUntil} onChange={set("repeatUntil")} />
        </Field>
      )}
      <Field label="Where"><input className="input" value={f.location} onChange={set("location")} placeholder="Caprock Canyons State Park" /></Field>
      <Field label="Details for families"><textarea className="input py-3 min-h-[100px]" value={f.description} onChange={set("description")} placeholder="Meet at the church parking lot at 5:30 PM Friday." /></Field>

      </div>

      <div className="card flex flex-col gap-3">
        <div className="font-display font-extrabold text-[20px]">Sign-up and cost</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cost per person ($)"><input className="input" inputMode="decimal" value={f.cost} onChange={set("cost")} placeholder="0" /></Field>
          <Field label="Spots (blank = no limit)"><input className="input" inputMode="numeric" value={f.cap} onChange={set("cap")} /></Field>
        </div>
        <Field label="Sign-up deadline" hint="Families can cancel for a full credit until this time.">
          <input className="input" type="datetime-local" value={f.deadline} onChange={set("deadline")} />
        </Field>
        <Field label="If someone cancels after the deadline">
          <select className="input" value={f.refund} onChange={set("refund")}>
            <option value="full">Full credit to their family balance</option>
            <option value="partial">Half credit (costs already spent)</option>
            <option value="none">No credit (non-refundable)</option>
          </select>
        </Field>
        <label className="flex items-center gap-3 text-[15px]">
          <input type="checkbox" className="w-5 h-5" checked={f.permission} onChange={set("permission")} />
          Needs a signed permission slip
        </label>

      </div>

      <details className="card flex flex-col gap-3" open={["campout", "service", "high_adventure"].includes(f.kind)}>
        <summary className="font-display font-extrabold text-[20px] cursor-pointer min-h-[44px] flex items-center">More options</summary>
        <div className="flex flex-col gap-4 mt-3">
        <Field label="Questions to ask families (one per line)" hint="Dietary needs are always asked.">
          <textarea className="input py-3 min-h-[80px]" value={f.questions} onChange={set("questions")} placeholder={"Bringing a hammock?\nShirt size"} />
        </Field>
        <div className="font-bold text-[16px]">Credit toward advancement</div>
        <p className="text-[13px] text-smoke m-0">Counted for each Scout marked present when you take attendance.</p>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Nights camped"><input className="input" inputMode="numeric" value={f.nights} onChange={set("nights")} placeholder={String(autoNights())} /></Field>
          <Field label="Service hours"><input className="input" inputMode="decimal" value={f.hours} onChange={set("hours")} placeholder="0" /></Field>
          <Field label="Miles"><input className="input" inputMode="decimal" value={f.miles} onChange={set("miles")} placeholder="0" /></Field>
        </div>

      <Field label="Who can see it">
        <select className="input" value={f.visibility} onChange={set("visibility")}>
          <option value="members">Members only</option>
          <option value="public">Public (shows on your troop page)</option>
        </select>
      </Field>

      <label className="flex items-center gap-3 text-[14px] font-bold" style={{ minHeight: 44 }}>
        <input type="checkbox" className="w-5 h-5" checked={f.shareLinked} onChange={(e) => setF({ ...f, shareLinked: e.target.checked })} />
        Show on linked units&apos; calendars
      </label>
        </div>
      </details>

      <button className="btn-primary self-start px-10" disabled={busy}>{busy ? "Saving…" : initial?.id ? "Save changes" : "Post event"}</button>
    </form>
  );
}

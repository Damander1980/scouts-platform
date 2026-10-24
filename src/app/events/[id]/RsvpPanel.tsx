"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ErrorBox, money } from "@/components/ui";

export type RsvpRow = {
  person_id: string; first_name: string; type: string; status: string | null;
  notes: string; dietary: string; driver_seats: number; answers: Record<string, string>; pending?: boolean;
};

export default function RsvpPanel({ eventId, canApprove = false, costCents, questions, family }: {
  eventId: string; canApprove?: boolean; costCents: number; questions: string[]; family: RsvpRow[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [rows, setRows] = useState(family);
  const [open, setOpen] = useState<string | null>(family.find((f) => !f.status)?.person_id ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<{ pid: string; credit: number } | null>(null);

  const update = (pid: string, patch: Partial<RsvpRow>) => setRows((rs) => rs.map((r) => (r.person_id === pid ? { ...r, ...patch } : r)));

  async function save(row: RsvpRow, status: "going" | "not_going") {
    setBusy(row.person_id); setError("");
    try {
      // A sign-up still waiting for a parent's OK was never charged, so there is no credit to preview.
      if (status === "not_going" && row.status === "going" && !row.pending && costCents > 0 && confirm?.pid !== row.person_id) {
        const { data, error: pErr } = await supabase.rpc("refund_preview", { p_event: eventId, p_person: row.person_id });
        if (pErr) throw pErr; // never claim "no credit" when we couldn't work it out
        setConfirm({ pid: row.person_id, credit: (data as number) ?? 0 });
        setBusy(null);
        return;
      }
      const { data, error } = await supabase.rpc("set_rsvp", {
        p_event: eventId, p_person: row.person_id, p_status: status, p_notes: row.notes || null,
        p_driver_seats: row.type === "adult" ? row.driver_seats : 0, p_dietary: row.dietary || null, p_answers: row.answers,
      });
      if (error) throw error;
      // A Scout signing up for a paid event may need a parent's OK; the server notifies parents if so.
      let pending = false;
      if (!canApprove && status === "going" && costCents > 0) {
        const { data: r } = await supabase.from("rsvps").select("rsvp_approval_status").eq("event_id", eventId).eq("person_id", row.person_id).maybeSingle();
        pending = r?.rsvp_approval_status === "pending";
        if (pending) fetch("/api/notify/approval", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId }) }).catch(() => {});
      }
      update(row.person_id, { status: data as string, pending });
      setConfirm(null);
      setOpen(rows.find((r) => r.person_id !== row.person_id && !r.status)?.person_id ?? null);
      router.refresh();
    } catch (e: any) { setError(e.message); }
    setBusy(null);
  }

  const goingCount = rows.filter((r) => r.status === "going" && !r.pending).length;

  async function decide(row: RsvpRow, approve: boolean) {
    setBusy(row.person_id); setError("");
    const { data, error } = await supabase.rpc("decide_scout_rsvp", { p_event: eventId, p_person: row.person_id, p_approve: approve });
    if (error) setError(error.message);
    else { update(row.person_id, { status: data as string, pending: false }); router.refresh(); }
    setBusy(null);
  }

  return (
    <section className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="font-display font-extrabold text-[22px]">Who is going?</div>
        {costCents > 0 && goingCount > 0 && <span className="text-[14px] font-bold">{money(goingCount * costCents)} added to your balance</span>}
      </div>
      <ErrorBox>{error}</ErrorBox>

      {rows.map((r) => {
        const isOpen = open === r.person_id;
        return (
          <div key={r.person_id} className="rounded-[14px] overflow-hidden" style={{ background: "#F8F5EE", boxShadow: r.status === "going" ? "inset 0 0 0 2px #12355F" : "inset 0 0 0 1px #DDD6C5" }}>
            <button onClick={() => setOpen(isOpen ? null : r.person_id)} aria-expanded={isOpen}
              className="w-full flex items-center gap-3 px-4 min-h-[56px] bg-transparent border-0 cursor-pointer text-left font-sans text-ink">
              <span className="font-bold text-[16px] flex-1">{r.first_name}</span>
              <span className="text-[13px] font-bold px-2.5 py-1 rounded-full" style={{
                background: r.status === "going" ? "#12355F" : r.status === "waitlisted" ? "#FFF6D6" : r.status === "not_going" ? "#F8F5EE" : "#FFF6D6",
                color: r.status === "going" ? "white" : r.status === "not_going" ? "#4B5568" : "#5E4400",
              }}>
                {r.pending ? "Needs your OK" : r.status === "going" ? "Going" : r.status === "waitlisted" ? "Waitlist" : r.status === "not_going" ? "Not going" : "Reply needed"}
              </span>
            </button>
            {r.pending && canApprove && (
              <div className="px-4 pb-4 flex flex-col gap-2">
                <span className="text-[14px]">{r.first_name} signed up. Approving adds {money(costCents)} to your family balance.</span>
                <div className="flex gap-2">
                  <button className="btn-primary flex-1" disabled={!!busy} onClick={() => decide(r, true)}>Approve and add to our bill</button>
                  <button className="btn-secondary" disabled={!!busy} onClick={() => decide(r, false)}>Decline</button>
                </div>
              </div>
            )}
            {isOpen && (
              <div className="px-4 pb-4 flex flex-col gap-3">
                <input aria-label="Food allergies or dietary needs" className="input" placeholder="Food allergies or dietary needs" value={r.dietary}
                  onChange={(e) => update(r.person_id, { dietary: e.target.value })} />
                {questions.map((q) => (
                  <input key={q} className="input" placeholder={q} value={r.answers[q] ?? ""}
                    onChange={(e) => update(r.person_id, { answers: { ...r.answers, [q]: e.target.value } })} />
                ))}
                {r.type === "adult" && (
                  <label className="flex items-center gap-3 text-[15px]">
                    Driving? Extra seats:
                    <input className="input w-20" inputMode="numeric" value={r.driver_seats || ""}
                      onChange={(e) => update(r.person_id, { driver_seats: parseInt(e.target.value || "0") || 0 })} />
                  </label>
                )}
                <input aria-label="Anything leaders should know (optional)" className="input" placeholder="Anything leaders should know (optional)" value={r.notes}
                  onChange={(e) => update(r.person_id, { notes: e.target.value })} />

                {confirm?.pid === r.person_id ? (
                  <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background: "#FFF6D6" }}>
                    <div className="font-bold text-[15px]">
                      {confirm.credit > 0 ? `You'll get ${money(confirm.credit)} back as a credit.` : "This cancellation gets no credit under the event's refund rule."}
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-primary flex-1" disabled={!!busy} onClick={() => save(r, "not_going")}>Confirm not going</button>
                      <button className="btn-secondary" onClick={() => setConfirm(null)}>Keep spot</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button className="btn-primary flex-1" disabled={!!busy} onClick={() => save(r, "going")}>
                      {busy === r.person_id ? "Saving…" : costCents > 0 && r.status !== "going" ? `Going · ${money(costCents)}` : "Going"}
                    </button>
                    <button className="btn-secondary flex-1" disabled={!!busy} onClick={() => save(r, "not_going")}>Not going</button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

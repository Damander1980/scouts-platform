"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/components/ui";

// What a Scout sees when they sign in: every upcoming event as one big card with two
// huge buttons. Built for 11-year-olds: one tap to answer, plain words, no forms.

export type ScoutEvent = {
  id: string; title: string; start_at: string; end_at: string | null; location: string | null; kind: string; cost_cents: number;
  rsvp_deadline: string | null;
  mine: { status: string; notes: string | null; dietary: string | null; answers: Record<string, string> } | null;
};

const WORDS: Record<string, { yes: string; no: string; going: string }> = {
  meeting:        { yes: "I'll be there", no: "I can't come", going: "You're coming to the meeting" },
  campout:        { yes: "I'm going camping", no: "Not this time", going: "You're going camping" },
  high_adventure: { yes: "I'm going", no: "Not this time", going: "You're going" },
  service:        { yes: "I'll help", no: "I can't help", going: "You're helping" },
  fundraiser:     { yes: "I'll help", no: "I can't help", going: "You're helping" },
};
const DEFAULT = { yes: "I'm coming", no: "I can't come", going: "You're coming" };

function when(e: ScoutEvent) {
  const s = new Date(e.start_at);
  const day = s.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const time = s.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (e.end_at && new Date(e.end_at).toDateString() !== s.toDateString()) {
    return `${day} to ${new Date(e.end_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`;
  }
  return `${day} at ${time}`;
}

export default function ScoutHome({ personId, firstName, events: initial }: { personId: string; firstName: string; events: ScoutEvent[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [events, setEvents] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [askParent, setAskParent] = useState<string | null>(null);
  const [changing, setChanging] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; msg: string } | null>(null);

  async function answer(e: ScoutEvent, status: "going" | "not_going") {
    // Paid trips add to the family bill, so check with a parent first.
    if (status === "going" && e.cost_cents > 0 && e.mine?.status !== "going" && askParent !== e.id) { setAskParent(e.id); return; }
    setBusy(e.id); setError(null);
    // Pass the existing answers through so a quick tap never wipes what a parent typed (allergies, notes).
    const { data, error } = await supabase.rpc("set_rsvp", {
      p_event: e.id, p_person: personId, p_status: status, p_notes: e.mine?.notes ?? null, p_driver_seats: 0,
      p_dietary: e.mine?.dietary ?? null, p_answers: e.mine?.answers ?? {},
    });
    if (error) setError({ id: e.id, msg: error.message });
    else {
      setEvents((all) => all.map((x) => x.id === e.id ? { ...x, mine: { ...(x.mine ?? { notes: null, dietary: null, answers: {} }), status: data as string } } : x));
      setAskParent(null); setChanging(null);
      router.refresh();
    }
    setBusy(null);
  }

  const open = events.filter((e) => !e.mine);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display font-extrabold text-[30px] leading-tight m-0">Hi, {firstName}!</h1>
        <p className="text-[17px] m-0 mt-1">{open.length ? `Tell us if you're coming to ${open.length === 1 ? "this" : `these ${open.length}`}.` : "You've answered everything. Nice!"}</p>
      </div>

      {events.length === 0 && <div className="card text-[17px]">Nothing on the calendar right now.</div>}

      {events.map((e) => {
        const w = WORDS[e.kind] ?? DEFAULT;
        const status = e.mine?.status;
        const late = !!e.rsvp_deadline && new Date(e.rsvp_deadline) < new Date();
        const showButtons = !status || changing === e.id;
        return (
          <div key={e.id} className="card flex flex-col gap-3" style={{ borderWidth: 2, borderColor: status === "going" ? "#1F5F4A" : status === "not_going" ? "#D5DFDA" : "#FF6A1A" }}>
            <div>
              <div className="font-display font-extrabold text-[22px] leading-tight">{e.title}</div>
              <div className="text-[16px] mt-1">{when(e)}</div>
              {e.location && <div className="text-[15px] text-smoke">{e.location}</div>}
              {e.cost_cents > 0 && <div className="text-[15px] font-bold mt-1">Costs {money(e.cost_cents)}</div>}
            </div>

            {!showButtons && (
              <div className="flex items-center justify-between gap-2 rounded-xl p-3" style={{ background: status === "going" ? "#EAF0ED" : status === "waitlisted" ? "#FFF1E6" : "#F4F6F5" }}>
                <span className="font-bold text-[18px]">
                  {status === "going" ? `${w.going}!` : status === "waitlisted" ? "It's full. You're on the waitlist." : "You said you can't come."}
                </span>
                {!late && <button className="btn-ghost text-[15px]" onClick={() => setChanging(e.id)}>Change</button>}
              </div>
            )}

            {showButtons && late && <div className="text-[16px] font-bold" style={{ color: "#7A2E00" }}>Sign-up is closed. Ask a leader.</div>}

            {showButtons && !late && (askParent === e.id ? (
              <div className="flex flex-col gap-2 rounded-xl p-3" style={{ background: "#FFF1E6" }}>
                <div className="font-bold text-[17px]">Did a parent say yes? This adds {money(e.cost_cents)} to your family&apos;s bill.</div>
                <button className="w-full rounded-2xl font-bold text-[19px] text-white border-0 cursor-pointer font-sans" style={{ background: "#1F5F4A", minHeight: 60 }}
                  disabled={busy === e.id} onClick={() => answer(e, "going")}>{busy === e.id ? "Saving..." : "Yes, sign me up"}</button>
                <button className="btn-secondary" style={{ minHeight: 48 }} onClick={() => setAskParent(null)}>I'll ask first</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button className="rounded-2xl font-bold text-[19px] text-white border-0 cursor-pointer font-sans" style={{ background: "#1F5F4A", minHeight: 64 }}
                  disabled={busy === e.id} onClick={() => answer(e, "going")}>{busy === e.id ? "Saving..." : w.yes}</button>
                <button className="rounded-2xl font-bold text-[19px] border-2 cursor-pointer font-sans bg-white" style={{ borderColor: "#D5DFDA", color: "#14211B", minHeight: 64 }}
                  disabled={busy === e.id} onClick={() => answer(e, "not_going")}>{w.no}</button>
              </div>
            ))}
            {error?.id === e.id && <div className="text-[15px] font-bold" style={{ color: "#A52A1C" }}>{error.msg}</div>}
          </div>
        );
      })}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LeaderEventTools({ eventId, canceled, ratioOk, adults, trained, youth, seats, noReply }: {
  eventId: string; canceled: boolean; ratioOk: boolean; adults: number; trained: number; youth: number; seats: number; noReply: number;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  async function cancel() {
    const { error } = await supabase.rpc("cancel_event", { p_event: eventId, p_reason: null });
    if (error) { setError(error.message); return; }
    // Tell everyone signed up right away (urgent notice; server checks leader rights and sends once).
    await fetch("/api/notify/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId }) }).catch(() => {});
    router.refresh();
  }

  return (
    <section className="card flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="font-display font-extrabold text-[20px]">Leader tools</div>
        <div className="flex gap-2 flex-wrap">
          {noReply > 0 && <Link href={`/messages/new?audience=nonresponders&ref=${eventId}`} className="btn-primary no-underline">Nudge {noReply} who haven&apos;t replied</Link>}
          <Link href={`/events/${eventId}/attendance`} className="btn-secondary no-underline">Take attendance</Link>
        </div>
      </div>
      <div className="rounded-xl px-4 py-3 text-[14px] font-bold"
        style={{ background: ratioOk ? "#EEE8D9" : "#FDECEA", color: ratioOk ? "#12355F" : "#A52A1C" }}>
        {ratioOk
          ? `Two-deep leadership met: ${adults} adults 21+ going, ${trained} with current Youth Protection Training, for ${youth} youth.`
          : `Not ready: Scouting America requires at least 2 registered adults age 21+, with current Youth Protection Training, at every youth activity. Now: ${adults} adults, ${trained} trained.`}
        {seats > 0 && <span className="font-normal"> Driver seats offered: {seats}.</span>}
      </div>
      {error && <div className="text-[14px] font-bold" style={{ color: "#A52A1C" }}>{error}</div>}
      <nav aria-label="More event tools" className="flex gap-x-5 gap-y-1 flex-wrap text-[14px] font-bold">
        <Link href={`/events/${eventId}/plan`} className="text-forest min-h-[44px] flex items-center">Trip plan</Link>
        <Link href={`/events/${eventId}/trip-sheet`} className="text-forest min-h-[44px] flex items-center">Trip sheet</Link>
        <Link href={`/messages/new?audience=event&ref=${eventId}`} className="text-forest min-h-[44px] flex items-center">Message who&apos;s going</Link>
        <a href={`/api/events/${eventId}/roster.csv`} className="text-forest min-h-[44px] flex items-center">Download roster</a>
        <Link href={`/events/${eventId}/edit`} className="text-forest min-h-[44px] flex items-center">Edit event</Link>
        <Link href={`/events/new?copy=${eventId}`} className="text-forest min-h-[44px] flex items-center">Copy this event</Link>
        {!canceled && (confirming
          ? <button className="btn-primary" onClick={cancel}>Yes, cancel, credit and notify everyone</button>
          : <button className="bg-transparent border-0 p-0 cursor-pointer font-sans font-bold text-[14px] min-h-[44px] ml-auto" style={{ color: "#A52A1C" }} onClick={() => setConfirming(true)}>Cancel event</button>)}
      </nav>
    </section>
  );
}

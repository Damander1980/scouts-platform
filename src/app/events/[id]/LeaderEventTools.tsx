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
    if (error) setError(error.message); else router.refresh();
  }

  return (
    <section className="card flex flex-col gap-3" style={{ background: "#F8F5EE" }}>
      <div className="font-bold text-[15px]">Leader tools</div>
      <div className="rounded-xl px-3 py-2 text-[14px] font-bold"
        style={{ background: ratioOk ? "#EEE8D9" : "#FDECEA", color: ratioOk ? "#12355F" : "#A52A1C" }}>
        {ratioOk
          ? `Two-deep leadership met: ${adults} adults 21+ going, ${trained} with current Youth Protection Training, for ${youth} youth.`
          : `Not ready: Scouting America requires at least 2 registered adults age 21+, with current Youth Protection Training, at every youth activity. Now: ${adults} adults, ${trained} trained.`}
      </div>
      {seats > 0 && <div className="text-[14px]">Driver seats offered: <b>{seats}</b> for {youth} youth.</div>}
      {error && <div className="text-[14px] font-bold" style={{ color: "#A52A1C" }}>{error}</div>}
      <div className="flex gap-2 flex-wrap">
        <Link href={`/events/${eventId}/attendance`} className="btn-secondary no-underline">Take attendance</Link>
        <Link href={`/events/${eventId}/plan`} className="btn-secondary no-underline">Trip plan</Link>
        <Link href={`/events/${eventId}/trip-sheet`} className="btn-secondary no-underline">Trip sheet</Link>
        <Link href={`/events/${eventId}/edit`} className="btn-secondary no-underline">Edit</Link>
        {noReply > 0 && <Link href={`/messages/new?audience=nonresponders&ref=${eventId}`} className="btn-secondary no-underline">Nudge {noReply} who haven&apos;t replied</Link>}
        <Link href={`/messages/new?audience=event&ref=${eventId}`} className="btn-secondary no-underline">Message who&apos;s going</Link>
        <a href={`/api/events/${eventId}/roster.csv`} className="btn-ghost no-underline">Download roster</a>
        {!canceled && (confirming
          ? <button className="btn-primary" onClick={cancel}>Yes, cancel and credit everyone</button>
          : <button className="btn-ghost" style={{ color: "#A52A1C" }} onClick={() => setConfirming(true)}>Cancel event</button>)}
      </div>
    </section>
  );
}

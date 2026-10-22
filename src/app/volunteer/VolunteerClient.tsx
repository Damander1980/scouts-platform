"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Chip, ErrorBox, TIME_ZONE } from "@/components/ui";

type Shift = { id: string; title: string; location: string | null; starts_at: string; ends_at: string; slots: number };
type Poll = { id: string; question: string; options: string[]; audience: string; closes_at: string | null };

export default function VolunteerClient({ family, shifts, signups, polls, votes, orgId }: {
  family: { id: string; name: string; type: string }[]; shifts: Shift[];
  signups: { shift_id: string; person_id: string; name: string }[]; polls: Poll[];
  votes: { poll_id: string; person_id: string; choice: number }[]; orgId: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const adults = family.filter((f) => f.type === "adult");
  const run = async (fn: () => Promise<void>) => { setBusy(true); setError(""); try { await fn(); router.refresh(); } catch (e: any) { setError(e.message); } setBusy(false); };

  const canVote = (p: Poll, f: { type: string }) =>
    p.audience === "all" || (p.audience === "youth" && f.type === "youth") || (p.audience === "adults" && f.type === "adult");

  return (
    <div className="flex flex-col gap-5">
      <ErrorBox>{error}</ErrorBox>
      <div className="grid gap-5 lg:grid-cols-2 items-start">

      <section className="flex flex-col gap-3">
        <h2 className="eyebrow m-0 text-smoke">Volunteer shifts</h2>
        {shifts.length === 0 && <div className="card text-smoke text-center py-6">No shifts posted right now.</div>}
        {shifts.map((s) => {
          const who = signups.filter((x) => x.shift_id === s.id);
          const full = who.length >= s.slots;
          return (
            <div key={s.id} className="card flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <b className="text-[16px]">{s.title}</b>
                <Chip tone={full ? "green" : "orange"}>{who.length} / {s.slots}</Chip>
              </div>
              <div className="text-[14px] text-smoke">
                {new Date(s.starts_at).toLocaleString("en-US", { timeZone: TIME_ZONE, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} to {new Date(s.ends_at).toLocaleTimeString("en-US", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" })}
                {s.location ? ` · ${s.location}` : ""}
              </div>
              {who.length > 0 && <div className="text-[13px]">{who.map((w) => w.name).join(", ")}</div>}
              <div className="flex gap-2 flex-wrap">
                {adults.map((a) => {
                  const mine = who.some((w) => w.person_id === a.id);
                  return mine ? (
                    <button key={a.id} className="btn-secondary" disabled={busy} onClick={() => run(async () => {
                      const { error } = await supabase.from("shift_signups").delete().eq("shift_id", s.id).eq("person_id", a.id); if (error) throw error;
                    })}>{a.name}: cancel</button>
                  ) : (
                    <button key={a.id} className="btn-primary" disabled={busy || full} onClick={() => run(async () => {
                      const { error } = await supabase.from("shift_signups").insert({ shift_id: s.id, person_id: a.id, org_id: orgId }); if (error) throw error;
                    })}>{full ? "Full" : `${a.name}: sign up`}</button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="eyebrow m-0 text-smoke">Polls</h2>
        {polls.length === 0 && <div className="card text-smoke text-center py-6">No open polls.</div>}
        {polls.map((p) => {
          const closed = !!p.closes_at && new Date(p.closes_at) < new Date();
          const total = votes.filter((v) => v.poll_id === p.id).length;
          const voters = family.filter((f) => canVote(p, f));
          return (
            <div key={p.id} className="card flex flex-col gap-2">
              <div className="flex items-center gap-2"><b className="text-[16px]">{p.question}</b>{closed && <Chip>Closed</Chip>}</div>
              {p.options.map((o, i) => {
                const n = votes.filter((v) => v.poll_id === p.id && v.choice === i).length;
                const pct = total ? Math.round((n / total) * 100) : 0;
                return (
                  <div key={i} className="flex flex-col gap-1">
                    <div className="flex justify-between text-[14px]"><span>{o}</span><span>{n}</span></div>
                    <div className="h-2 rounded-full" style={{ background: "#EAE4D6" }}><div className="h-2 rounded-full" style={{ width: `${pct}%`, background: "#12355F" }} /></div>
                  </div>
                );
              })}
              {!closed && voters.map((f) => {
                const mine = votes.find((v) => v.poll_id === p.id && v.person_id === f.id);
                return mine ? <div key={f.id} className="text-[13px] text-smoke">{f.name} voted: {p.options[mine.choice]}</div> : (
                  <div key={f.id} className="flex gap-2 flex-wrap items-center">
                    <span className="text-[13px] font-bold">{f.name}:</span>
                    {p.options.map((o, i) => (
                      <button key={i} className="btn-secondary min-h-[36px] text-[13px]" disabled={busy} onClick={() => run(async () => {
                        const { error } = await supabase.from("poll_votes").insert({ poll_id: p.id, person_id: f.id, org_id: orgId, choice: i }); if (error) throw error;
                      })}>{o}</button>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </section>
      </div>
    </div>
  );
}
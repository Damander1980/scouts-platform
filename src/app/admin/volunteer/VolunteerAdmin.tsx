"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Chip, ErrorBox, Field, TIME_ZONE } from "@/components/ui";

type Shift = { id: string; title: string; location: string | null; starts_at: string; ends_at: string; slots: number };
type Poll = { id: string; question: string; options: string[]; audience: string; closes_at: string | null };

export default function VolunteerAdmin({ orgId, shifts, signups, polls, votes }: {
  orgId: string; shifts: Shift[]; signups: { shift_id: string; person_id: string; name: string }[]; polls: Poll[]; votes: { poll_id: string; choice: number }[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [s, setS] = useState({ title: "", location: "", start: "", end: "", slots: "2" });
  const [p, setP] = useState({ question: "", options: "", audience: "all", closes: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => { setBusy(true); setError(""); try { await fn(); router.refresh(); } catch (e: any) { setError(e.message); } setBusy(false); };

  return (
    <div className="flex flex-col gap-5">
      <div><h1 className="font-display font-extrabold text-[32px] m-0">Volunteers & polls</h1>
        <p className="text-[14px] text-smoke m-0 mt-1">Shift sign-ups for booths and fundraisers, and quick votes for families or the Patrol Leaders&apos; Council.</p></div>
      <ErrorBox>{error}</ErrorBox>

      <section className="flex flex-col gap-2">
        <div className="font-bold text-[16px]">Volunteer shifts</div>
        <form className="card grid sm:grid-cols-5 gap-2 items-end" onSubmit={(e) => { e.preventDefault(); run(async () => {
          const { error } = await supabase.from("shifts").insert({ org_id: orgId, title: s.title, location: s.location || null, starts_at: new Date(s.start).toISOString(), ends_at: new Date(s.end).toISOString(), slots: parseInt(s.slots) || 1 });
          if (error) throw error; setS({ ...s, title: "" });
        }); }}>
          <Field label="Shift"><input className="input" value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} required placeholder="Popcorn booth at Kroger" /></Field>
          <Field label="Where"><input className="input" value={s.location} onChange={(e) => setS({ ...s, location: e.target.value })} /></Field>
          <Field label="Starts"><input className="input" type="datetime-local" value={s.start} onChange={(e) => setS({ ...s, start: e.target.value })} required /></Field>
          <Field label="Ends"><input className="input" type="datetime-local" value={s.end} onChange={(e) => setS({ ...s, end: e.target.value })} required /></Field>
          <Field label="Spots"><input className="input" inputMode="numeric" value={s.slots} onChange={(e) => setS({ ...s, slots: e.target.value })} /></Field>
          <button className="btn-primary sm:col-span-5" disabled={busy}>Add shift</button>
        </form>
        {shifts.map((x) => {
          const who = signups.filter((y) => y.shift_id === x.id);
          return (
            <div key={x.id} className="card flex items-center gap-2 flex-wrap">
              <b>{x.title}</b><span className="text-smoke text-[13px]">{new Date(x.starts_at).toLocaleString("en-US", { timeZone: TIME_ZONE, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
              <Chip tone={who.length >= x.slots ? "green" : "orange"}>{who.length} / {x.slots}</Chip>
              <span className="text-[13px]">{who.map((w) => w.name).join(", ")}</span>
            </div>
          );
        })}
        <p className="text-[12px] text-smoke m-0">Families sign up from their Events page under Volunteer.</p>
      </section>

      <section className="flex flex-col gap-2">
        <div className="font-bold text-[16px]">Polls</div>
        <form className="card grid sm:grid-cols-2 gap-2" onSubmit={(e) => { e.preventDefault(); run(async () => {
          const options = p.options.split("\n").map((o) => o.trim()).filter(Boolean);
          if (options.length < 2) throw new Error("Give at least two choices, one per line.");
          const { data: { user } } = await supabase.auth.getUser();
          const { data: me } = await supabase.from("persons").select("id").eq("user_id", user!.id).single();
          const { error } = await supabase.from("polls").insert({ org_id: orgId, question: p.question, options, audience: p.audience, closes_at: p.closes ? new Date(p.closes).toISOString() : null, created_by: me!.id });
          if (error) throw error; setP({ question: "", options: "", audience: "all", closes: "" });
        }); }}>
          <Field label="Question"><input className="input" value={p.question} onChange={(e) => setP({ ...p, question: e.target.value })} required placeholder="Where should spring campout be?" /></Field>
          <Field label="Who votes"><select className="input" value={p.audience} onChange={(e) => setP({ ...p, audience: e.target.value })}>
            <option value="all">Everyone</option><option value="youth">Scouts</option><option value="adults">Adults</option><option value="plc">Patrol Leaders&apos; Council</option></select></Field>
          <Field label="Choices (one per line)"><textarea className="input py-2 min-h-[90px]" value={p.options} onChange={(e) => setP({ ...p, options: e.target.value })} /></Field>
          <Field label="Closes"><input className="input" type="datetime-local" value={p.closes} onChange={(e) => setP({ ...p, closes: e.target.value })} /></Field>
          <button className="btn-primary sm:col-span-2" disabled={busy}>Create poll</button>
        </form>
        {polls.map((poll) => {
          const total = votes.filter((v) => v.poll_id === poll.id).length;
          return (
            <div key={poll.id} className="card flex flex-col gap-2">
              <div className="flex items-center gap-2"><b>{poll.question}</b><Chip>{poll.audience === "plc" ? "PLC" : poll.audience}</Chip><span className="ml-auto text-[13px] text-smoke">{total} votes</span></div>
              {poll.options.map((o, i) => {
                const n = votes.filter((v) => v.poll_id === poll.id && v.choice === i).length;
                const pct = total ? Math.round((n / total) * 100) : 0;
                return (
                  <div key={i} className="flex flex-col gap-1">
                    <div className="flex justify-between text-[14px]"><span>{o}</span><span>{n} ({pct}%)</span></div>
                    <div className="h-2 rounded-full" style={{ background: "#EAE4D6" }}><div className="h-2 rounded-full" style={{ width: `${pct}%`, background: "#12355F" }} /></div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </section>
    </div>
  );
}

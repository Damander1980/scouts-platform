"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ScoutbookSync from "@/components/ScoutbookSync";
import { createClient } from "@/lib/supabase/client";
import { Chip, ErrorBox, Stat } from "@/components/ui";

type Q = { progress_id: string; person_id: string; scout: string; item: string; item_kind: string; item_id: string; number: string; requirement: string; done_at: string; can_sign: boolean };
type S = { person_id: string; first_name: string; last_name: string; birthdate: string | null; current_rank: string | null; rank_earned_at: string | null; badges_earned: number; eagle_groups: number; badges_in_progress: number; pending_signoffs: number };
type A = { adv_id: string; scout: string; item: string; kind: string; completed_at: string; purchased_at: string | null; presented_at: string | null };
type R = { id: string; person_id: string; scout: string; badge: string; at: string };

const age = (b: string | null) => (b ? Math.floor((Date.now() - new Date(b).getTime()) / (365.25 * 86400000)) : null);

export default function AdvancementAdmin({ orgId, scoutbookPending = null, unitType, queue, summary, awards, requests }: { orgId: string; scoutbookPending?: number | null; unitType: string; queue: Q[]; summary: S[]; awards: A[]; requests: R[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [tab, setTab] = useState<"queue" | "scouts" | "awards">(queue.length || requests.length ? "queue" : "scouts");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [me, setMe] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const allSignable = queue.filter((q) => q.can_sign).map((q) => q.progress_id);
  void orgId;

  const run = async (fn: () => Promise<void>) => { setBusy(true); setError(""); try { await fn(); router.refresh(); } catch (e: any) { setError(e.message); } setBusy(false); };
  const myId = async () => {
    if (me) return me;
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from("persons").select("id").eq("user_id", user!.id).single();
    setMe(data!.id); return data!.id as string;
  };

  const sign = (ids: string[]) => run(async () => {
    const pid = await myId();
    const { error } = await supabase.from("requirement_progress").update({ approved_by: pid, approved_at: new Date().toISOString() }).in("id", ids);
    if (error) throw error;
  });

  const grouped = queue.reduce<Record<string, Q[]>>((a, q) => ({ ...a, [`${q.scout}|${q.item}`]: [...(a[`${q.scout}|${q.item}`] ?? []), q] }), {});
  const eagleTrack = summary.filter((s) => s.current_rank === "Life" || s.current_rank === "Star");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display font-extrabold text-[32px] m-0">Advancement</h1>
        <p className="text-[14px] text-smoke m-0 mt-1">Sign-offs, merit badge requests, every Scout&apos;s progress, and what to buy for the next Court of Honor.</p>
      </div>
      <ErrorBox>{error}</ErrorBox>
      <ScoutbookSync pending={scoutbookPending} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Waiting for sign-off" value={queue.length} tone={queue.length ? "#5E4400" : undefined} />
        <Stat label="Badge requests" value={requests.length} />
        <Stat label="Awards to buy" value={awards.filter((a) => !a.purchased_at).length} />
        <a href="/admin/advancement/eagle" className="no-underline text-ink"><Stat label="On the Eagle trail" value={<>{eagleTrack.length} <span className="text-[14px] font-sans font-bold text-forest">Eagle projects →</span></>} /></a>
      </div>

      <div role="tablist" className="flex gap-6 overflow-x-auto border-b-2 border-[#DDD6C5]">
        {([["queue", "Sign-offs & requests"], ["scouts", "Scout progress"], ["awards", "Court of Honor list"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className="min-h-[44px] -mb-[2px] px-0.5 bg-transparent border-0 border-b-[3px] cursor-pointer font-sans text-[15px] whitespace-nowrap"
            style={{ borderColor: tab === k ? "#F5B700" : "transparent", color: tab === k ? "#101B2D" : "#4B5568", fontWeight: tab === k ? 700 : 500 }}>{l}</button>
        ))}
      </div>

      {tab === "queue" && (
        <div className="flex flex-col gap-3">
          {requests.length > 0 && (
            <div className="card flex flex-col gap-2" style={{ background: "#FFF6D6", borderColor: "#F0DA8C" }}>
              <div className="font-bold text-[15px]">Merit badge requests (blue cards)</div>
              {requests.map((r) => (
                <div key={r.id} className="flex items-center gap-2 flex-wrap text-[14px]">
                  <b>{r.scout}</b> wants to start <b>{r.badge}</b>
                  <Link href={`/scout/${r.person_id}/advancement`} className="btn-secondary no-underline ml-auto">Approve & assign counselor</Link>
                </div>
              ))}
            </div>
          )}
          {queue.length === 0 && requests.length === 0 && <div className="card text-smoke">Nothing waiting. Nice work.</div>}
          {allSignable.length > 1 && (
            <div className="card flex items-center gap-3 flex-wrap">
              <span className="flex-1 text-[15px]"><b>{allSignable.length} requirements</b> are waiting for your sign-off.</span>
              {confirmAll
                ? <><button className="btn-primary" disabled={busy} onClick={() => { setConfirmAll(false); sign(allSignable); }}>Yes, sign all {allSignable.length}</button>
                    <button className="btn-secondary" onClick={() => setConfirmAll(false)}>Cancel</button></>
                : <button className="btn-primary" disabled={busy} onClick={() => setConfirmAll(true)}>Sign everything I can</button>}
            </div>
          )}
          {Object.entries(grouped).map(([k, list]) => {
            const [scout, item] = k.split("|");
            const signable = list.filter((q) => q.can_sign).map((q) => q.progress_id);
            return (
              <div key={k} className="card flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <b className="text-[15px]">{scout}</b><span className="text-smoke">·</span><span className="font-bold">{item}</span>
                  <Chip>{list[0].item_kind === "rank" ? "Rank" : list[0].item_kind === "badge" ? "Merit badge" : "Adventure"}</Chip>
                  {signable.length > 1 && <button className="btn-primary ml-auto" disabled={busy} onClick={() => sign(signable)}>Sign all {signable.length}</button>}
                </div>
                {list.map((q) => (
                  <div key={q.progress_id} className="flex items-start gap-2 text-[14px] py-1 border-t border-[#EEE8D9]">
                    <span className="font-bold w-8 flex-none">{q.number}</span>
                    <span className="flex-1">{q.requirement}</span>
                    {q.can_sign ? <button className="btn-secondary min-h-[36px]" disabled={busy} onClick={() => sign([q.progress_id])}>Sign off</button>
                      : <Chip>Counselor signs</Chip>}
                  </div>
                ))}
                <Link href={`/scout/${list[0].person_id}/advancement`} className="text-[13px] font-bold text-forest no-underline">Open {scout.split(" ")[0]}&apos;s page</Link>
              </div>
            );
          })}
        </div>
      )}

      {tab === "scouts" && (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead><tr className="text-left text-[11px] uppercase text-smoke">
              <th className="px-3 py-2">Scout</th><th className="px-2">Age</th><th className="px-2">Rank</th><th className="px-2">Since</th>
              <th className="px-2">Merit badges</th><th className="px-2">Eagle req.</th><th className="px-2">In progress</th><th className="px-2">To sign</th>
            </tr></thead>
            <tbody>
              {summary.map((s) => {
                const a = age(s.birthdate);
                return (
                  <tr key={s.person_id} className="border-t border-[#EEE8D9]">
                    <td className="px-3 py-2"><Link href={`/scout/${s.person_id}/advancement`} className="font-bold text-ink no-underline">{s.last_name}, {s.first_name}</Link></td>
                    <td className="px-2">{a ?? "—"} {a !== null && a >= 17 && s.current_rank !== "Eagle Scout" && <Chip tone="orange">Turns 18 soon</Chip>}</td>
                    <td className="px-2">{s.current_rank ?? "—"}</td>
                    <td className="px-2 text-smoke">{s.rank_earned_at ? new Date(s.rank_earned_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—"}</td>
                    <td className="px-2">{s.badges_earned}</td>
                    <td className="px-2">{s.eagle_groups} / 14</td>
                    <td className="px-2">{s.badges_in_progress}</td>
                    <td className="px-2">{s.pending_signoffs > 0 ? <Chip tone="orange">{s.pending_signoffs}</Chip> : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === "awards" && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <a className="btn-secondary no-underline" href="/api/export/advancement.csv">Advancement report for the Scout Shop (CSV)</a>
            <a className="btn-secondary no-underline" href="/admin/advancement/court-of-honor">Print shopping list and program</a>
            {awards.some((a) => !a.purchased_at) && (
              <button className="btn-secondary" disabled={busy} onClick={() => run(async () => {
                const ids = awards.filter((a) => !a.purchased_at).map((a) => a.adv_id);
                const { error } = await supabase.from("scout_advancement").update({ purchased_at: new Date().toISOString() }).in("id", ids);
                if (error) throw error;
              })}>Mark all bought</button>
            )}
          </div>
          <p className="text-[13px] text-smoke m-0">Council Scout Shops usually need an advancement report from Scoutbook to sell awards. Enter these in Scoutbook (or upload the CSV), then mark them bought and presented here.</p>
          {awards.length === 0 && <div className="card text-smoke">Nothing waiting to be presented.</div>}
          {awards.map((a) => (
            <div key={a.adv_id} className="card flex items-center gap-2 flex-wrap">
              <b className="text-[15px]">{a.scout}</b><span>{a.item}</span><Chip>{a.kind === "rank" ? "Rank" : a.kind === "badge" ? "Merit badge" : "Adventure"}</Chip>
              <span className="text-[12px] text-smoke">earned {new Date(a.completed_at).toLocaleDateString()}</span>
              <div className="ml-auto flex gap-2">
                {!a.purchased_at
                  ? <button className="btn-secondary" disabled={busy} onClick={() => run(async () => { const { error } = await supabase.from("scout_advancement").update({ purchased_at: new Date().toISOString() }).eq("id", a.adv_id); if (error) throw error; })}>Mark bought</button>
                  : <Chip tone="green">Bought</Chip>}
                <button className="btn-primary" disabled={busy} onClick={() => run(async () => { const { error } = await supabase.from("scout_advancement").update({ presented_at: new Date().toISOString() }).eq("id", a.adv_id); if (error) throw error; })}>Presented</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

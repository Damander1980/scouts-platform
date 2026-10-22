"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { rankChecks } from "@/lib/rankRules";

export type Requirement = { id: string; number: string; text: string; sort: number };
export type Program = "scouts_bsa" | "cubs";
export type Extras = {
  birthdate: string | null;
  rankEarned: Record<string, string | null>;
  positions: { title: string; start_date: string; end_date: string | null; counts_for_rank: boolean }[];
  credits: { nights: number; service: number; miles: number; events: number };
  serviceEvents: { at: string; hours: number }[];
  counselors: { id: string; name: string; items: string[] }[];
  eagle?: { title: string; done: number; total: number; next: string | null; passed: boolean } | null;
};
export type Item = {
  id: string; kind: "rank" | "badge" | "adventure"; code: string; name: string;
  eagle_required: boolean; eagle_group: string | null; sort: number;
  program: Program; rank_code: string | null; required: boolean;
  electives_needed: number | null; grade: string | null; source_slug: string | null;
  requirements: Requirement[];
};
export type Tracked = { id?: string; item_id: string; status: "requested" | "assigned" | "in_progress" | "completed" | "declined"; assigned_by: string | null; counselor_id?: string | null };
export type Progress = Record<string, { completed_at: string | null; approved_by: string | null }>;

const EAGLE_SLOTS = 14;
const EAGLE_TOTAL = 21;

const ICONS: Record<string, string> = {
  camping: "M3 20h18L12 4 3 20zm9-9l4 9H8l4-9z",
  first_aid: "M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z",
  hiking: "M3 20l6-10 4 6 3-4 5 8z",
  cooking: "M7 2v9a2 2 0 002 2v9M5 2v6M9 2v6M17 2c-2 2-2 6 0 8v12",
  swimming: "M2 16c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 20c2-2 4-2 6 0s4 2 6 0 4-2 6 0M8 12l4-6 4 4",
  cycling: "M5 18a3 3 0 100-6 3 3 0 000 6zm14 0a3 3 0 100-6 3 3 0 000 6zM5 15l4-7h5l5 7M9 8l3 7",
  citizenship_in_the_nation: "M5 21V4m0 0h11l-2 4 2 4H5",
  citizenship_in_the_community: "M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6",
  citizenship_in_the_world: "M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
  communication: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  personal_fitness: "M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12",
  family_life: "M3 10l9-7 9 7v11H3z",
};
const RANK_PDFS: Record<string, string> = {
  scout: "Scout-Rank.pdf", tenderfoot: "Tenderfoot-Rank.pdf", second_class: "Second-Class-v2.pdf",
  first_class: "First-Class.pdf", star: "Star-Rank.pdf", life: "Life-Rank.pdf",
  eagle: "Scouts-BSA-Rank-Requirements.pdf",
};

function officialUrl(item: Item) {
  if (item.kind === "rank") return `https://www.scouting.org/wp-content/uploads/2025/12/${RANK_PDFS[item.code] ?? "Scouts-BSA-Rank-Requirements.pdf"}`;
  return `https://www.scouting.org/merit-badges/${item.code.replace(/_/g, "-")}/`;
}

function OfficialLink({ item }: { item: Item }) {
  return (
    <a href={officialUrl(item)} target="_blank" rel="noopener noreferrer"
      className="text-[12px] font-bold no-underline inline-flex items-center gap-1" style={{ color: "#12355F" }}>
      Official requirements
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>
    </a>
  );
}

const DEFAULT_ICON ="M12 15a6 6 0 100-12 6 6 0 000 12zM8.5 14L7 22l5-3 5 3-1.5-8";

function Icon({ code, size = 20 }: { code: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[code] ?? DEFAULT_ICON} />
    </svg>
  );
}

function SegmentBar({ total, done, approved }: { total: number; done: number; approved: number }) {
  const segs = Math.max(total, 1);
  return (
    <div className="flex gap-[3px] h-3 w-full">
      {Array.from({ length: segs }).map((_, i) => (
        <div key={i} className="flex-1 rounded-[3px]"
          style={{ background: i < approved ? "#12355F" : i < done ? "#7FB59E" : "#EAE4D6" }} />
      ))}
    </div>
  );
}

export default function AdvancementClient({
  scout, orgId, items, tracked: initialTracked, progress: initialProgress,
  isLeader, viewerPersonId, demo = false, counselorBadgeIds = [], extras,
}: {
  counselorBadgeIds?: string[];
  extras?: Extras;
  scout: { id: string; first_name: string; last_name: string };
  orgId: string;
  items: Item[];
  tracked: Tracked[];
  progress: Progress;
  isLeader: boolean;
  viewerPersonId: string;
  demo?: boolean;
}) {
  const supabase = useMemo(() => (demo ? null : createClient()), [demo]);
  const [tracked, setTracked] = useState(initialTracked);
  const [progress, setProgress] = useState(initialProgress);
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "eagle" | "elective" | "earned">("all");
  const [picker, setPicker] = useState(false);
  const [pickSearch, setPickSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cubRankCode, setCubRankCode] = useState<string | null>(null);

  const ranks = items.filter((i) => i.kind === "rank" && i.program === "scouts_bsa").sort((a, b) => a.sort - b.sort);
  const badges = items.filter((i) => i.kind === "badge");
  const trackedMap = Object.fromEntries(tracked.map((t) => [t.item_id, t]));
  const counselorSet = new Set(counselorBadgeIds);
  const canSign = (item: Item) => isLeader || (item.kind === "badge" && counselorSet.has(item.id));

  const stats = (item: Item) => {
    const total = item.requirements.length;
    const done = item.requirements.filter((r) => progress[r.id]?.completed_at).length;
    const approved = item.requirements.filter((r) => progress[r.id]?.approved_by).length;
    const completed = trackedMap[item.id]?.status === "completed" || (total > 0 && approved === total);
    const pct = completed ? 100 : total ? Math.round((done / total) * 100) : 0;
    return { total, done, approved, completed, pct };
  };

  const earnedBadges = badges.filter((b) => stats(b).completed);
  const eagleGroupsEarned = new Set(
    earnedBadges.filter((b) => b.eagle_required).map((b) => b.eagle_group ?? b.code)
  ).size;
  const currentRankIdx = ranks.reduce((acc, r, i) => (stats(r).completed && acc === i - 1 ? i : acc), -1);
  const currentRank = currentRankIdx >= 0 ? ranks[currentRankIdx] : null;
  const nextRank = ranks[currentRankIdx + 1] ?? null;

  const myBadges = badges
    .filter((b) => trackedMap[b.id])
    .filter((b) => {
      if (filter === "eagle") return b.eagle_required;
      if (filter === "elective") return !b.eagle_required;
      if (filter === "earned") return stats(b).completed;
      return true;
    })
    .sort((a, b) => Number(stats(a).completed) - Number(stats(b).completed) || a.sort - b.sort);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await fn(); } catch (e: any) { setError(e.message ?? String(e)); }
    setBusy(false);
  };

  const toggleDone = (req: Requirement) => run(async () => {
    const cur = progress[req.id];
    const nextDone = cur?.completed_at ? null : new Date().toISOString();
    if (!demo) {
      const { error } = await supabase!.from("requirement_progress").upsert(
        { org_id: orgId, person_id: scout.id, requirement_id: req.id, completed_at: nextDone, approved_by: null, approved_at: null },
        { onConflict: "person_id,requirement_id" },
      );
      if (error) throw error;
    }
    setProgress((p) => ({ ...p, [req.id]: { completed_at: nextDone, approved_by: null } }));
  });

  const signOff = (item: Item, req: Requirement) => run(async () => {
    const now = new Date().toISOString();
    const completed_at = progress[req.id]?.completed_at ?? now;
    if (!demo) {
      const { error } = await supabase!.from("requirement_progress").upsert(
        { org_id: orgId, person_id: scout.id, requirement_id: req.id, completed_at, approved_by: viewerPersonId, approved_at: now },
        { onConflict: "person_id,requirement_id" },
      );
      if (error) throw error;
    }
    const next = { ...progress, [req.id]: { completed_at, approved_by: viewerPersonId } };
    setProgress(next);
    const allSigned = item.requirements.every((r) => next[r.id]?.approved_by);
    if (allSigned) await setStatus(item, "completed");
  });

  const setStatus = async (item: Item, status: Tracked["status"]) => {
    if (!demo) {
      const { error } = await supabase!.from("scout_advancement").upsert(
        { org_id: orgId, person_id: scout.id, item_id: item.id, status,
          completed_at: status === "completed" ? new Date().toISOString() : null },
        { onConflict: "person_id,item_id" },
      );
      if (error) throw error;
    }
    setTracked((t) => {
      const others = t.filter((x) => x.item_id !== item.id);
      return [...others, { item_id: item.id, status, assigned_by: trackedMap[item.id]?.assigned_by ?? null }];
    });
  };

  // Blue card: a Scout requests a merit badge; a unit leader approves it and assigns a counselor.
  const addBadge = (item: Item) => run(async () => {
    const status: Tracked["status"] = isLeader ? "assigned" : item.kind === "badge" ? "requested" : "in_progress";
    const assigned_by = isLeader ? viewerPersonId : null;
    if (!demo) {
      const { error } = await supabase!.from("scout_advancement").insert(
        { org_id: orgId, person_id: scout.id, item_id: item.id, status, assigned_by },
      );
      if (error) throw error;
    }
    setTracked((t) => [...t, { item_id: item.id, status, assigned_by, counselor_id: null }]);
    setPicker(false); setPickSearch(""); setOpen(item.id);
  });

  const removeBadge = (item: Item) => run(async () => {
    if (!demo) {
      const { error } = await supabase!.from("scout_advancement").delete()
        .eq("person_id", scout.id).eq("item_id", item.id);
      if (error) throw error;
    }
    setTracked((t) => t.filter((x) => x.item_id !== item.id));
    setOpen(null);
  });

  const RequirementList = ({ item }: { item: Item }) => (
    <div className="flex flex-col gap-2 pt-3">
      {item.requirements.length === 0 && (
        <div className="rounded-xl px-4 py-3 text-[13px]" style={{ background: "#F8F5EE", color: "#4B5568" }}>
          Detailed requirements for this badge aren&apos;t loaded yet. Work with your merit badge counselor using the official pamphlet.
          {canSign(item) && !stats(item).completed && (
            <button onClick={() => run(() => setStatus(item, "completed"))} disabled={busy}
              className="ml-2 font-bold underline bg-transparent border-0 cursor-pointer p-0"
              style={{ color: "#12355F", fontFamily: "inherit" }}>
              Mark earned
            </button>
          )}
        </div>
      )}
      {item.requirements.map((r) => {
        const p = progress[r.id];
        const done = !!p?.completed_at;
        const signed = !!p?.approved_by;
        const canToggle = !signed || canSign(item);
        return (
          <div key={r.id} className="flex items-start gap-3 rounded-xl px-3 py-2.5"
            style={{ background: signed ? "#EEE8D9" : done ? "#F8F5EE" : "#FFFFFF", border: "1px solid #EAE4D6" }}>
            <button onClick={() => canToggle && toggleDone(r)} disabled={busy || !canToggle}
              aria-label={done ? "Mark not done" : "Mark done"}
              className="w-6 h-6 mt-0.5 rounded-md flex-none flex items-center justify-center border-2 cursor-pointer"
              style={{
                borderColor: done ? "#12355F" : "#AEB9C9",
                background: done ? "#12355F" : "white",
                cursor: canToggle ? "pointer" : "default",
              }}>
              {done && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              )}
            </button>
            <div className="flex-1 flex flex-col gap-1">
              <span className="text-[14px] leading-snug">
                <span className="font-bold mr-1.5" style={{ color: "#4B5568" }}>{r.number}.</span>{r.text}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {signed ? (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#12355F", color: "white" }}>Signed off</span>
                ) : done ? (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#FFF6D6", color: "#5E4400" }}>Done — needs leader sign-off</span>
                ) : (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#F8F5EE", color: "#4B5568" }}>Not started</span>
                )}
                {canSign(item) && !signed && (
                  <button onClick={() => signOff(item, r)} disabled={busy}
                    className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border cursor-pointer"
                    style={{ borderColor: "#12355F", color: "#12355F", background: "white", fontFamily: "inherit" }}>
                    Sign off
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const pickable = badges
    .filter((b) => !trackedMap[b.id])
    .filter((b) => !pickSearch || b.name.toLowerCase().includes(pickSearch.toLowerCase()))
    .sort((a, b) => Number(b.eagle_required) - Number(a.eagle_required) || a.name.localeCompare(b.name));


  return (
    <div className="min-h-screen bg-canvas" style={{ color: "#101B2D", fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <header className="bg-forest text-white px-4 sm:px-8 pt-6 pb-8">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center flex-none font-display font-extrabold text-[18px]"
            style={{ background: "#F5B700", color: "#101B2D" }}>
            {scout.first_name[0]}{scout.last_name[0]}
          </div>
          <div className="flex-1">
            <div className="eyebrow" style={{ color: "#AEB9C9" }}>Advancement</div>
            <h1 className="font-display font-extrabold text-[28px] leading-tight m-0">{scout.first_name} {scout.last_name}</h1>
            <div className="text-[14px]" style={{ color: "#D7E0EE" }}>
              {currentRank ? `${currentRank.name} rank` : "Working on Scout rank"}
              {nextRank ? ` · next up: ${nextRank.name}` : ""}
            </div>
          </div>
          <a href={isLeader ? "/admin/members" : "/dashboard"} className="min-h-[44px] px-5 rounded-full font-bold text-[14px] flex items-center no-underline text-white" style={{ border: "1px solid rgba(255,255,255,.3)" }}>
            {isLeader ? "Back to roster" : "Back home"}
          </a>
          {!scout.id.startsWith("demo") && (
            <a href={`/scout/${scout.id}/advancement/print`} className="min-h-[44px] px-5 rounded-full font-bold text-[14px] flex items-center no-underline" style={{ background: "#F5B700", color: "#101B2D" }}>
              Print history
            </a>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-8 -mt-5 pb-16 flex flex-col gap-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Current rank", value: currentRank?.name ?? "—" },
            { label: "Merit badges", value: `${earnedBadges.length} / ${EAGLE_TOTAL}` },
            { label: "Eagle required", value: `${eagleGroupsEarned} / ${EAGLE_SLOTS}` },
            { label: "Next rank", value: nextRank ? `${stats(nextRank).pct}%` : "Eagle!" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-4 border border-[#DDD6C5]">
              <div className="eyebrow" style={{ color: "#4B5568" }}>{s.label}</div>
              <div className="font-display font-extrabold text-[22px] mt-1">{s.value}</div>
            </div>
          ))}
        </div>

        {nextRank && (() => {
          const left = nextRank.requirements.filter((q) => !progress[q.id]?.approved_by);
          const waiting = left.filter((q) => progress[q.id]?.completed_at).length;
          return (
            <div className="patch flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[240px] flex flex-col gap-1">
                <span className="eyebrow" style={{ color: "#F5B700" }}>Next step to {nextRank.name}</span>
                <span className="font-display font-extrabold text-[22px] leading-tight">
                  {left.length === 0 ? "Every requirement is signed off" : `${left.length} requirement${left.length === 1 ? "" : "s"} left: ${left.slice(0, 6).map((q) => q.number).join(", ")}${left.length > 6 ? "…" : ""}`}
                </span>
                {waiting > 0 && <span className="text-[14px]" style={{ color: "#D7E0EE" }}>{waiting} marked done and waiting for a leader to sign off.</span>}
              </div>
              <button onClick={() => setOpen(nextRank.id)} className="min-h-[44px] px-5 rounded-full font-bold text-[15px] border-0 cursor-pointer" style={{ background: "#F5B700", color: "#101B2D", fontFamily: "inherit" }}>
                {isLeader ? "Open and sign off" : "See requirements"}
              </button>
            </div>
          );
        })()}

        {error && <div className="rounded-xl px-4 py-3 text-[14px] font-bold" style={{ background: "#FFF6D6", color: "#5E4400" }}>{error}</div>}

        {extras && (
          <div className="bg-white rounded-[18px] shadow-float p-4 flex flex-wrap gap-x-6 gap-y-2 items-center">
            <span className="eyebrow" style={{ color: "#4B5568" }}>From attendance</span>
            <span className="text-[15px]"><b>{extras.credits.nights}</b> nights camped</span>
            <span className="text-[15px]"><b>{extras.credits.service}</b> service hours</span>
            <span className="text-[15px]"><b>{extras.credits.miles}</b> miles</span>
            <span className="text-[15px]"><b>{extras.credits.events}</b> events</span>
            <span className="text-[12px]" style={{ color: "#AEB9C9" }}>Camping merit badge needs 20 nights at Scouting events.</span>
          </div>
        )}

        {extras?.eagle && (
          <div className="bg-white rounded-[18px] shadow-float p-5 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[220px]">
              <div className="eyebrow text-forest">Eagle project</div>
              <div className="font-display font-extrabold text-[20px]">{extras.eagle.title}</div>
              <div className="text-[14px] text-smoke">{extras.eagle.passed ? "Board of review passed. Eagle Scout!" : extras.eagle.next ? `Next: ${extras.eagle.next}` : "Board of review held"}</div>
            </div>
            <div className="w-48 h-2 rounded-full" style={{ background: "#EEE8D9" }}>
              <div className="h-2 rounded-full" style={{ width: `${(extras.eagle.done / extras.eagle.total) * 100}%`, background: "#12355F" }} />
            </div>
          </div>
        )}

        {/* Rank trail */}
        <section className="flex flex-col gap-3">
          <h2 className="eyebrow m-0" style={{ color: "#4B5568" }}>Rank trail</h2>
          <div className="bg-white rounded-[18px] shadow-float p-4 overflow-x-auto">
            <div className="flex items-start min-w-[560px]">
              {ranks.map((r, i) => {
                const s = stats(r);
                const isCurrent = i === currentRankIdx + 1;
                return (
                  <div key={r.id} className="flex-1 flex flex-col items-center relative">
                    {i > 0 && (
                      <div className="absolute top-5 right-1/2 w-full h-1 -z-0"
                        style={{ background: i <= currentRankIdx ? "#12355F" : "#EAE4D6" }} />
                    )}
                    <button onClick={() => setOpen(open === r.id ? null : r.id)}
                      className="relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 cursor-pointer font-bold text-[13px]"
                      style={{
                        fontFamily: "inherit",
                        background: s.completed ? "#12355F" : isCurrent ? "#F5B700" : "white",
                        borderColor: s.completed ? "#12355F" : isCurrent ? "#F5B700" : "#DDD6C5",
                        color: s.completed ? "white" : "#101B2D",
                        outline: open === r.id ? "3px solid #AEB9C9" : "none",
                      }}>
                      {s.completed ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                      ) : s.pct > 0 ? `${s.pct}%` : i + 1}
                    </button>
                    <span className="text-[12px] font-bold mt-2 text-center leading-tight">{r.name}</span>
                  </div>
                );
              })}
            </div>
            {ranks.map((r) => open === r.id && (
              <div key={r.id} className="mt-4 border-t border-[#EEE8D9] pt-3">
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold text-[18px]">{r.name} requirements</span>
                  <span className="text-[13px] font-bold" style={{ color: "#4B5568" }}>
                    {stats(r).done} / {stats(r).total} done · {stats(r).approved} signed off
                  </span>
                </div>
                <div className="mt-1"><OfficialLink item={r} /></div>
                {extras && (() => {
                  const checks = rankChecks(r.code, {
                    birthdate: extras.birthdate, rankEarned: extras.rankEarned, positions: extras.positions,
                    badgesEarned: earnedBadges.map((b) => ({ eagle_required: b.eagle_required, eagle_group: b.eagle_group, code: b.code })),
                    serviceHoursSince: (since) => extras.serviceEvents.filter((e) => !since || e.at >= since).reduce((s, e) => s + e.hours, 0),
                  });
                  return checks.length > 0 && (
                    <div className="mt-3 rounded-xl p-3 flex flex-col gap-1.5" style={{ background: "#F8F5EE" }}>
                      <div className="eyebrow" style={{ color: "#4B5568" }}>Automatic checks</div>
                      {checks.map((c) => (
                        <div key={c.label} className="flex items-center gap-2 text-[14px]">
                          <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-none" style={{ background: c.ok ? "#12355F" : "#C0392B" }}>{c.ok ? "✓" : "!"}</span>
                          <span className="font-bold">{c.label}</span><span style={{ color: "#4B5568" }}>{c.detail}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                <RequirementList item={r} />
              </div>
            ))}
          </div>
        </section>

        {/* Merit badges */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="eyebrow m-0" style={{ color: "#4B5568" }}>Merit badges</h2>
            <button onClick={() => setPicker(!picker)}
              className="min-h-[40px] px-5 rounded-full font-bold text-[14px] border-0 cursor-pointer"
              style={{ background: "#F5B700", color: "#101B2D", fontFamily: "inherit" }}>
              {isLeader ? "+ Assign badge" : "+ Start a badge"}
            </button>
          </div>

          {picker && (
            <div className="bg-white rounded-[18px] shadow-float p-4 flex flex-col gap-3">
              <input autoFocus value={pickSearch} onChange={(e) => setPickSearch(e.target.value)}
                placeholder={`Search ${badges.length} merit badges…`}
                className="rounded-xl border border-[#DDD6C5] px-3 py-2 text-[14px] outline-none"
                style={{ fontFamily: "inherit" }} />
              <div className="max-h-72 overflow-y-auto flex flex-col">
                {pickable.slice(0, 60).map((b) => (
                  <button key={b.id} onClick={() => addBadge(b)} disabled={busy}
                    className="flex items-center gap-3 px-2 py-2 rounded-lg text-left bg-transparent border-0 cursor-pointer hover:bg-[#F8F5EE]"
                    style={{ fontFamily: "inherit", color: "#101B2D" }}>
                    <span style={{ color: "#12355F" }}><Icon code={b.code} size={18} /></span>
                    <span className="text-[14px] font-bold flex-1">{b.name}</span>
                    {b.eagle_required && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#FFF6D6", color: "#5E4400" }}>Eagle required</span>
                    )}
                  </button>
                ))}
                {pickable.length === 0 && <div className="text-[14px] px-2 py-4" style={{ color: "#AEB9C9" }}>No badges match.</div>}
              </div>
            </div>
          )}

          <div className="flex gap-1.5 flex-wrap">
            {([["all","All"],["eagle","Eagle required"],["elective","Electives"],["earned","Earned"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setFilter(k)}
                className="px-3 py-1.5 rounded-full text-[12px] font-bold border cursor-pointer"
                style={{
                  fontFamily: "inherit",
                  background: filter === k ? "#12355F" : "white",
                  color: filter === k ? "white" : "#4B5568",
                  borderColor: filter === k ? "#12355F" : "#DDD6C5",
                }}>
                {label}
              </button>
            ))}
          </div>

          {myBadges.length === 0 && (
            <div className="bg-white rounded-[18px] shadow-float p-6 text-center text-[15px]" style={{ color: "#4B5568" }}>
              No badges here yet. Tap <b>{isLeader ? "+ Assign badge" : "+ Start a badge"}</b> to pick one.
            </div>
          )}

          <div className="flex flex-col gap-2">
            {myBadges.map((b) => {
              const s = stats(b);
              const t = trackedMap[b.id];
              const isOpen = open === b.id;
              return (
                <div key={b.id} className="bg-white rounded-2xl border overflow-hidden"
                  style={{ borderColor: isOpen ? "#12355F" : "#DDD6C5" }}>
                  <button onClick={() => setOpen(isOpen ? null : b.id)}
                    className="w-full flex items-center gap-3 p-4 bg-transparent border-0 cursor-pointer text-left"
                    style={{ fontFamily: "inherit", color: "#101B2D" }}
                    aria-expanded={isOpen}>
                    <div className="w-11 h-11 rounded-full flex items-center justify-center flex-none relative"
                      style={{ background: s.completed ? "#12355F" : "#EEE8D9", color: s.completed ? "white" : "#12355F" }}>
                      <Icon code={b.code} />
                      {b.eagle_required && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ background: "#F5B700" }} title="Eagle required">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="#101B2D"><path d="M12 2l3 7 7 .6-5.3 4.6 1.6 7.3L12 17.8 5.7 21.5l1.6-7.3L2 9.6 9 9z"/></svg>
                        </span>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[15px] truncate">{b.name}</span>
                        {t?.status === "assigned" && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-none" style={{ background: "#EEE8D9", color: "#12355F" }}>Assigned by leader</span>
                        )}
                        {t?.status === "requested" && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-none" style={{ background: "#FFF6D6", color: "#5E4400" }}>Waiting for leader OK</span>
                        )}
                        {t?.counselor_id && extras && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-none" style={{ background: "#F8F5EE", color: "#4B5568" }}>
                            Counselor: {extras.counselors.find((c) => c.id === t.counselor_id)?.name ?? "assigned"}
                          </span>
                        )}
                        {s.completed && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-none" style={{ background: "#12355F", color: "white" }}>Earned</span>
                        )}
                        <span className="ml-auto font-display font-bold text-[15px] flex-none">{s.pct}%</span>
                      </div>
                      {s.total > 0
                        ? <SegmentBar total={s.total} done={s.done} approved={s.approved} />
                        : <div className="h-3 rounded-[3px]" style={{ background: s.completed ? "#12355F" : "#EAE4D6" }} />}
                    </div>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4B5568" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      className="flex-none transition-transform" style={{ transform: isOpen ? "rotate(180deg)" : "none" }} aria-hidden="true">
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 border-t border-[#EEE8D9]">
                      <div className="flex items-center justify-between pt-3 text-[13px] font-bold" style={{ color: "#4B5568" }}>
                        <span className="flex items-center gap-3 flex-wrap">
                          <span>{s.done} of {s.total || "?"} done · {s.approved} signed off</span>
                          <OfficialLink item={b} />
                        </span>
                        {!s.completed && (
                          <button onClick={() => removeBadge(b)} disabled={busy}
                            className="text-[12px] font-bold bg-transparent border-0 cursor-pointer"
                            style={{ color: "#C0392B", fontFamily: "inherit" }}>
                            Remove
                          </button>
                        )}
                      </div>
                      {isLeader && t && ["requested", "assigned"].includes(t.status) && !t.counselor_id && (
                        <div className="mt-3 rounded-xl p-3 flex flex-col gap-2" style={{ background: "#FFF6D6" }}>
                          <div className="text-[14px] font-bold">Approve the start (blue card) and assign a counselor</div>
                          {(extras?.counselors ?? []).filter((c) => c.items.includes(b.id)).length === 0 ? (
                            <div className="text-[13px]">No approved counselor for {b.name} yet. Add one on the Members page.</div>
                          ) : (
                            <div className="flex gap-2 flex-wrap">
                              {(extras?.counselors ?? []).filter((c) => c.items.includes(b.id)).map((c) => (
                                <button key={c.id} disabled={busy} className="text-[13px] font-bold px-3 py-1.5 rounded-full border cursor-pointer bg-white"
                                  style={{ borderColor: "#12355F", color: "#12355F", fontFamily: "inherit" }}
                                  onClick={() => run(async () => {
                                    if (!demo && t.id) {
                                      const { error } = await supabase!.rpc("approve_badge_start", { p_adv: t.id, p_counselor: c.id });
                                      if (error) throw error;
                                    }
                                    setTracked((all) => all.map((x) => (x.item_id === b.id ? { ...x, status: "in_progress", counselor_id: c.id } : x)));
                                  })}>
                                  {c.name}
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="text-[12px]" style={{ color: "#4B5568" }}>Remind the Scout: bring a buddy to every counselor meeting (no one-on-one contact).</div>
                        </div>
                      )}
                      <RequirementList item={b} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <p className="text-[12px] m-0" style={{ color: "#AEB9C9" }}>
          Requirements follow the official 2026 numbering in plain-language summaries. Tap &ldquo;Official requirements&rdquo; for Scouting America&apos;s exact wording.
          Legend: dark green = signed off by a leader, light green = done by the scout, waiting on sign-off.
        </p>
      </div>
    </div>
  );
}

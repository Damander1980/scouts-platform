// Scouts BSA rank rules that can be checked from data (Scouts BSA Requirements, 2026).
// These support — never replace — the leader's sign-off.

export type RuleInput = {
  birthdate: string | null;
  rankEarned: Record<string, string | null>; // rank code -> date earned
  badgesEarned: { eagle_required: boolean; eagle_group: string | null; code: string }[];
  positions: { title: string; start_date: string; end_date: string | null; counts_for_rank: boolean }[];
  serviceHoursSince: (since: string | null) => number;
};

export type Check = { label: string; ok: boolean; detail: string };

// Calendar day [y, m, d]: a plain date is taken as written; a moment is read in the troop's zone.
// (new Date("2026-04-15") is UTC midnight, the evening before in Texas, which made tenure and age
// checks pass a day early.)
const TZ = process.env.NEXT_PUBLIC_TIME_ZONE || "America/Chicago";
const ymd = (x: string | Date) => {
  const s = typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : new Date(x).toLocaleDateString("en-CA", { timeZone: TZ });
  return s.split("-").map(Number);
};
const monthsBetween = (a: string | Date, b: string | Date = new Date()) => {
  const [sy, sm, sd] = ymd(a), [by, bm, bd] = ymd(b);
  return (by - sy) * 12 + bm - sm - (bd < sd ? 1 : 0);
};

function eagleCount(badges: RuleInput["badgesEarned"]) {
  return new Set(badges.filter((b) => b.eagle_required).map((b) => b.eagle_group ?? b.code)).size;
}

// Position months served while holding the previous rank (APL doesn't count; for Eagle, bugler doesn't either).
function porMonths(input: RuleInput, since: string | null, rank: "star" | "life" | "eagle") {
  if (!since) return 0;
  const day = (x: string | Date) => ymd(x).map((n, i) => String(n).padStart(i ? 2 : 4, "0")).join("-");
  const from = day(since), today = day(new Date());
  // Two positions held at the same time are one stretch of service, not double the months.
  const spans = input.positions
    .filter((p) => p.counts_for_rank && p.title !== "Assistant Patrol Leader" && !(rank === "eagle" && p.title === "Bugler"))
    .map((p) => [p.start_date.slice(0, 10) > from ? p.start_date.slice(0, 10) : from, p.end_date ? day(p.end_date) : today] as [string, string])
    .filter(([s, e]) => e > s)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const merged: [string, string][] = [];
  for (const [s, e] of spans) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) { if (e > last[1]) last[1] = e; } else merged.push([s, e]);
  }
  return merged.reduce((sum, [s, e]) => sum + Math.max(0, monthsBetween(s, e)), 0);
}

export function rankChecks(code: string, input: RuleInput): Check[] {
  const out: Check[] = [];
  const age = input.birthdate ? monthsBetween(input.birthdate) / 12 : null;
  if (age !== null && age >= 18 && code !== "eagle") {
    out.push({ label: "Under 18", ok: false, detail: "Ranks must be completed before the 18th birthday." });
  }
  const order = ["scout", "tenderfoot", "second_class", "first_class", "star", "life", "eagle"];
  const prev = order[order.indexOf(code) - 1];
  if (prev && !input.rankEarned[prev]) {
    out.push({ label: "Previous rank earned", ok: false, detail: "Ranks are earned in order (requirements for Scout through First Class can be worked on at the same time)." });
  }

  const n = input.badgesEarned.length;
  const e = eagleCount(input.badgesEarned);
  if (code === "star" || code === "life" || code === "eagle") {
    const prevDate = input.rankEarned[prev] ?? null;
    const needMonths = code === "star" ? 4 : 6;
    const tenure = prevDate ? monthsBetween(prevDate) : 0;
    out.push({ label: `${needMonths} months active since ${prev === "first_class" ? "First Class" : prev[0].toUpperCase() + prev.slice(1)}`, ok: tenure >= needMonths, detail: prevDate ? `${tenure} months so far` : "Previous rank not recorded yet" });

    const [needBadges, needEagle] = code === "star" ? [6, 4] : code === "life" ? [11, 7] : [21, 14];
    out.push({ label: `${needBadges} merit badges, ${needEagle} Eagle-required`, ok: n >= needBadges && e >= needEagle, detail: `${n} earned, ${e} Eagle-required` });

    const months = porMonths(input, prevDate, code);
    out.push({ label: `${needMonths} months in a position of responsibility`, ok: months >= needMonths, detail: `${months} months recorded since ${prev.replace("_", " ")}` });

    if (code !== "eagle") {
      const hrs = input.serviceHoursSince(prevDate);
      out.push({ label: "6 hours of service" + (code === "life" ? " (3 conservation)" : ""), ok: hrs >= 6, detail: `${hrs} hours from attended service events since ${prev.replace("_", " ")}` });
    }
  }
  return out;
}

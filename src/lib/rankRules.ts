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

const monthsBetween = (a: string, b: Date = new Date()) => {
  const s = new Date(a);
  return (b.getFullYear() - s.getFullYear()) * 12 + b.getMonth() - s.getMonth() - (b.getDate() < s.getDate() ? 1 : 0);
};

function eagleCount(badges: RuleInput["badgesEarned"]) {
  return new Set(badges.filter((b) => b.eagle_required).map((b) => b.eagle_group ?? b.code)).size;
}

// Position months served while holding the previous rank (APL doesn't count; for Eagle, bugler doesn't either).
function porMonths(input: RuleInput, since: string | null, rank: "star" | "life" | "eagle") {
  if (!since) return 0;
  const start = new Date(since);
  return input.positions
    .filter((p) => p.counts_for_rank && p.title !== "Assistant Patrol Leader" && !(rank === "eagle" && p.title === "Bugler"))
    .reduce((sum, p) => {
      const s = new Date(Math.max(new Date(p.start_date).getTime(), start.getTime()));
      const e = p.end_date ? new Date(p.end_date) : new Date();
      return sum + Math.max(0, monthsBetween(s.toISOString(), e));
    }, 0);
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

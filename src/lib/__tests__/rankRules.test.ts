import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rankChecks, type RuleInput } from "../rankRules";

const base = (over: Partial<RuleInput> = {}): RuleInput => ({
  birthdate: "2012-03-01",
  rankEarned: { scout: "2024-09-01", tenderfoot: "2024-12-01", second_class: "2025-03-01", first_class: "2025-06-01" },
  badgesEarned: [],
  positions: [],
  serviceHoursSince: () => 0,
  ...over,
});
const badges = (n: number, eagle: number) => Array.from({ length: n }, (_, i) => ({ eagle_required: i < eagle, eagle_group: null, code: `b${i}` }));
const byLabel = (checks: ReturnType<typeof rankChecks>, start: string) => checks.find((c) => c.label.startsWith(start))!;

describe("rankChecks", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-21T12:00:00Z")); });
  afterEach(() => vi.useRealTimers());

  it("requires ranks in order", () => {
    const c = rankChecks("star", base({ rankEarned: {} }));
    expect(byLabel(c, "Previous rank earned").ok).toBe(false);
  });

  it("Star: 4 months since First Class, 6 badges with 4 Eagle-required, 4 months in a position, 6 service hours", () => {
    const ready = rankChecks("star", base({
      badgesEarned: badges(6, 4),
      positions: [{ title: "Patrol Leader", start_date: "2025-06-01", end_date: null, counts_for_rank: true }],
      serviceHoursSince: () => 6,
    }));
    expect(ready.every((c) => c.ok)).toBe(true);
  });

  it("Star: too few Eagle-required badges fails", () => {
    expect(byLabel(rankChecks("star", base({ badgesEarned: badges(6, 3) })), "6 merit badges").ok).toBe(false);
  });

  it("assistant patrol leader time doesn't count toward a position of responsibility", () => {
    const c = rankChecks("star", base({ positions: [{ title: "Assistant Patrol Leader", start_date: "2025-06-01", end_date: null, counts_for_rank: true }] }));
    expect(byLabel(c, "4 months in a position").ok).toBe(false);
  });

  it("only counts position time after the previous rank", () => {
    const c = rankChecks("star", base({
      rankEarned: { ...base().rankEarned, first_class: "2026-09-01" },
      positions: [{ title: "Patrol Leader", start_date: "2025-01-01", end_date: null, counts_for_rank: true }],
    }));
    expect(byLabel(c, "4 months in a position").ok).toBe(false);
  });

  it("Eagle needs 21 badges with 14 Eagle-required and no service-hours check", () => {
    const c = rankChecks("eagle", base({ rankEarned: { ...base().rankEarned, star: "2025-10-01", life: "2026-01-01" }, badgesEarned: badges(21, 14) }));
    expect(byLabel(c, "21 merit badges").ok).toBe(true);
    expect(c.some((x) => x.label.includes("service"))).toBe(false);
  });

  it("flags ranks attempted at 18 or older, except Eagle", () => {
    expect(rankChecks("life", base({ birthdate: "2008-01-01" })).some((c) => c.label === "Under 18")).toBe(true);
    expect(rankChecks("eagle", base({ birthdate: "2008-01-01" })).some((c) => c.label === "Under 18")).toBe(false);
  });
});

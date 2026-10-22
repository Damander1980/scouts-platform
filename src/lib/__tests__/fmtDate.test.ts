import { describe, expect, it } from "vitest";
import { fmtDate } from "@/components/ui";

describe("fmtDate", () => {
  it("shows a plain date as that same day, not the day before", () => {
    expect(fmtDate("2026-11-01", { month: "short", day: "numeric" })).toBe("Nov 1");
  });
  it("shows a timestamp in the unit's time zone", () => {
    // 3am UTC on Nov 2 is still Nov 1 in Central time.
    expect(fmtDate("2026-11-02T03:00:00Z", { month: "short", day: "numeric" })).toBe("Nov 1");
  });
});

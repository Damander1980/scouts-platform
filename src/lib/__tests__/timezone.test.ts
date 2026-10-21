import { describe, expect, it } from "vitest";
import { dayOfMonth, fmtDate, fmtTime } from "../../components/ui";

// Hosting runs on UTC. A 7 PM Thursday meeting in Plano is 00:00 UTC Friday and must still read 7 PM Thursday.
describe("unit time zone formatting", () => {
  const iso = "2026-10-23T00:00:00Z"; // Thu Oct 22, 7:00 PM in Central (CDT)
  it("shows the unit's local time, not the server's", () => {
    expect(fmtTime(iso)).toBe("7:00 PM");
    expect(fmtDate(iso, { weekday: "short", month: "short", day: "numeric" })).toBe("Thu, Oct 22");
    expect(dayOfMonth(iso)).toBe(22);
  });
});

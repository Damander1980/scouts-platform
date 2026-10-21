import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import MonthGrid from "../../app/events/MonthGrid";

describe("MonthGrid", () => {
  const events = [
    { id: "camp", title: "Caprock campout", start_at: "2026-10-23T22:00:00Z", end_at: "2026-10-25T17:00:00Z", kind: "campout", canceled: false, org_id: "o1" },
    { id: "mtg", title: "Troop meeting", start_at: "2026-10-23T00:00:00Z", end_at: "2026-10-23T01:30:00Z", kind: "meeting", canceled: false, org_id: "o1" },
  ];
  const html = renderToStaticMarkup(<MonthGrid month="2026-10" events={events} ownOrg="o1" />);

  it("labels the month", () => expect(html).toContain("October 2026"));
  it("shows a multi-day trip on each day it covers", () => expect(html.match(/Caprock campout/g)?.length).toBe(3));
  it("puts a 7 PM Thursday meeting on Thursday the 22nd, not Friday", () => {
    const cells = html.split('min-h-[104px]');
    const day22 = cells.find((c) => />22<\/span>/.test(c))!;
    expect(day22).toContain("Troop meeting");
  });
});

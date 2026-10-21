import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "../csv";

describe("csv", () => {
  it("round-trips quotes, commas and newlines", () => {
    const rows = [{ Name: 'Jake "JJ" Garcia', Note: "a, b\nc" }];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
  it("neutralizes spreadsheet formulas", () => {
    expect(toCsv([{ a: "=SUM(A1)" }])).toContain("'=SUM(A1)");
  });
  it("handles a byte-order mark, CRLF and blank lines", () => {
    expect(parseCsv("\uFEFFFirst Name,Last Name\r\nJake,Garcia\r\n\r\n")).toEqual([{ "First Name": "Jake", "Last Name": "Garcia" }]);
  });
});

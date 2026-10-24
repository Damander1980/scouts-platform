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
  it("leaves negative numbers as numbers", () => {
    expect(toCsv([{ Amount: "-12.50" }])).toBe("Amount\r\n-12.50");
  });
  it("treats a quote inside an unquoted field as text", () => {
    expect(parseCsv('Name,Patrol\nWilliam "Billy" Ray,Eagles\nJake,Hawks')).toEqual([
      { Name: 'William "Billy" Ray', Patrol: "Eagles" }, { Name: "Jake", Patrol: "Hawks" }]);
  });
  it("handles a byte-order mark, CRLF and blank lines", () => {
    expect(parseCsv("﻿First Name,Last Name\r\nJake,Garcia\r\n\r\n")).toEqual([{ "First Name": "Jake", "Last Name": "Garcia" }]);
  });
});

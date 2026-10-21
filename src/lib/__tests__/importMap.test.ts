import { describe, expect, it } from "vitest";
import { parseCsv } from "../csv";
import { mapAdvancement, mapRoster, toIsoDate } from "../importMap";

describe("mapRoster", () => {
  it("reads a Scoutbook Plus style roster", () => {
    const rows = mapRoster(parseCsv(
      "First Name,Last Name,Member ID,Type,Position,Sub Unit,YPT Expiration Date\n" +
      "Aarav,Gupta,140358347,YOUTH,Youth Member,Heroic Hedgehogs,\n" +
      "Alegra,Reyes,12770532,ADULT,Assistant Scoutmaster,,04/11/2027\n"));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ first: "Aarav", type: "youth", role: "scout", patrol: "Heroic Hedgehogs", member_id: "140358347" });
    expect(rows[1]).toMatchObject({ first: "Alegra", type: "adult", role: "assistant_scoutmaster", ypt_expires: "2027-04-11" });
  });

  it("splits a single Name column", () => {
    expect(mapRoster(parseCsv("Name,Type\n\"Garcia, Jake\",Youth\nMaya Garcia,Youth\n")).map((r) => [r.first, r.last]))
      .toEqual([["Jake", "Garcia"], ["Maya", "Garcia"]]);
  });

  it("treats leaders as adults when no type column exists", () => {
    expect(mapRoster(parseCsv("First,Last,Role\nTom,Garcia,Scoutmaster\nJake,Garcia,Scout\n")).map((r) => r.type)).toEqual(["adult", "youth"]);
  });

  it("drops rows without a name", () => {
    expect(mapRoster(parseCsv("First,Last\n,\nJake,Garcia\n"))).toHaveLength(1);
  });
});

describe("mapAdvancement", () => {
  it("splits requirement numbers and keeps the advancement type", () => {
    const rows = mapAdvancement(parseCsv(
      "First Name,Last Name,Advancement Type,Advancement,Date Completed\n" +
      "Jake,Garcia,Rank Requirement,Second Class #1a,2025-04-02\n" +
      "Jake,Garcia,Merit Badge,First Aid Merit Badge,6/12/2025\n" +
      "Sam,Lee,Adventure,Bobcat Lion,2025-01-05\n"));
    expect(rows[0]).toMatchObject({ item: "Second Class", requirement: "1a", date: "2025-04-02" });
    expect(rows[1]).toMatchObject({ item: "First Aid", requirement: "", date: "2025-06-12" });
    expect(rows[2].type).toBe("Adventure");
  });
});

describe("toIsoDate", () => {
  it("handles US dates and blanks", () => {
    expect(toIsoDate("4/11/27")).toBe("2027-04-11");
    expect(toIsoDate("")).toBe("");
    expect(toIsoDate("not a date")).toBe("");
  });
});

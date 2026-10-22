import { describe, expect, it } from "vitest";
import { safeNext } from "./safeNext";

describe("safeNext", () => {
  it("keeps same-site paths", () => expect(safeNext("/events/1?x=2", "/home")).toBe("/events/1?x=2"));
  it("blocks other sites", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "/\tevil", "", null]) expect(safeNext(bad, "/home")).toBe("/home");
  });
});

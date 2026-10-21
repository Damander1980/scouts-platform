import { describe, expect, it } from "vitest";
import { rankRequirements, ranks, reqKey, signIn, ScoutbookError } from "../scoutbook";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("scoutbook client", () => {
  it("signs in with the username in the path and the password as a form field", async () => {
    let seen: { url: string; init?: RequestInit } | null = null;
    const f = (async (url: string, init?: RequestInit) => { seen = { url, init }; return json(200, { token: "t0k", account: { userId: 12345 } }); }) as unknown as typeof fetch;
    const s = await signIn("leader@example.com", "p&ss word", f);
    expect(s).toEqual({ token: "t0k", userId: "12345" });
    expect(seen!.url).toBe("https://my.scouting.org/api/users/leader%40example.com/authenticate");
    expect(seen!.init?.method).toBe("POST");
    expect(String(seen!.init?.body)).toBe("password=p%26ss+word");
  });

  it("reports a rejected login plainly", async () => {
    const f = (async () => json(401, { message: "nope" })) as unknown as typeof fetch;
    await expect(signIn("a", "b", f)).rejects.toThrow("didn't accept");
  });

  it("refuses a sign-in response without a token", async () => {
    const f = (async () => json(200, { account: {} })) as unknown as typeof fetch;
    await expect(signIn("a", "b", f)).rejects.toBeInstanceOf(ScoutbookError);
  });

  it("sends the bearer token and reads ranks and requirements", async () => {
    const calls: string[] = [];
    const f = (async (url: string, init?: RequestInit) => {
      calls.push(`${url} ${(init?.headers as Record<string, string>).Authorization}`);
      return url.includes("/requirements") ? json(200, { requirements: [{ id: "9", requirementNumber: "1a" }] }) : json(200, { ranks: [{ id: "2", name: "Tenderfoot" }] });
    }) as unknown as typeof fetch;
    const s = { token: "abc", userId: "1" };
    expect((await ranks(s, f))[0].name).toBe("Tenderfoot");
    expect((await rankRequirements(s, "2", f))[0].requirementNumber).toBe("1a");
    expect(calls[0]).toBe("https://api.scouting.org/advancements/ranks?programId=2&status=active Bearer abc");
  });

  it("normalizes requirement numbers", () => {
    expect(reqKey("1 (a)")).toBe("1a");
    expect(reqKey("10b")).toBe("10b");
  });
});

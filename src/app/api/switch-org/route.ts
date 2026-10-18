import { NextResponse } from "next/server";
import { ORG_COOKIE } from "@/lib/context";

export async function POST(request: Request) {
  const { orgId } = await request.json();
  const res = NextResponse.json({ ok: true });
  if (typeof orgId === "string" && /^[0-9a-f-]{36}$/.test(orgId)) {
    res.cookies.set(ORG_COOKIE, orgId, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  }
  return res;
}

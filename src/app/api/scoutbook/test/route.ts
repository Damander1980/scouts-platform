import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/admin";
import { ScoutbookError, ranks, signIn } from "@/lib/scoutbook";

// "Test connection" for the stored Scoutbook login: signs in on the server and reads one harmless
// list (rank names). The password and token never leave the server or reach the browser.
export async function POST(request: Request) {
  const { orgId } = await request.json().catch(() => ({}));
  if (typeof orgId !== "string") return NextResponse.json({ error: "bad request" }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("can_connect_scoutbook", { p_org: orgId });
  if (!allowed) return NextResponse.json({ error: "Only Key 3 leaders or the advancement chair can test Scoutbook." }, { status: 403 });

  const db = adminClient();
  if (!db) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const { data: login } = await db.rpc("scoutbook_login_for_sync", { p_org: orgId }).maybeSingle<{ username: string; password: string }>();
  if (!login) return NextResponse.json({ error: "No Scoutbook login is connected." }, { status: 404 });

  try {
    const session = await signIn(login.username, login.password);
    const list = await ranks(session);
    await db.from("scoutbook_connections").update({ last_error: null }).eq("org_id", orgId);
    return NextResponse.json({ ok: true, ranks: list.length });
  } catch (e) {
    const message = e instanceof ScoutbookError ? e.message : "Couldn't reach Scoutbook. Try again later.";
    await db.from("scoutbook_connections").update({ last_error: message }).eq("org_id", orgId);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}

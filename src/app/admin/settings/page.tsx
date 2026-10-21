import { requireStaff } from "@/lib/context";
import UnitSettings from "./UnitSettings";
import LinkedUnits from "./LinkedUnits";
import ScoutbookConnect from "./ScoutbookConnect";

// Two-way Scoutbook sync stays hidden until the sync job exists, so no login is stored for nothing.
const SCOUTBOOK_SYNC = process.env.NEXT_PUBLIC_SCOUTBOOK_SYNC === "on";

export default async function UnitSettingsPage() {
  const { supabase, current, isAdmin } = await requireStaff();
  const { data: org } = await supabase.from("organizations").select("id, name, unit_number, city, state, settings, second_approval_cents, slug").eq("id", current.org.id).single();
  const [{ data: token }, { data: links }, sbConn, sbCan] = await Promise.all([
    supabase.rpc("org_calendar_token", { p_org: current.org.id }),
    supabase.rpc("linked_units", { p_org: current.org.id }),
    SCOUTBOOK_SYNC ? supabase.from("scoutbook_connections").select("scoutbook_username, scoutbook_position, created_at, last_sync_at, last_error").eq("org_id", current.org.id).maybeSingle() : Promise.resolve({ data: null }),
    SCOUTBOOK_SYNC ? supabase.rpc("can_connect_scoutbook", { p_org: current.org.id }) : Promise.resolve({ data: false }),
  ]);
  return <>
    <UnitSettings org={org as never} isAdmin={isAdmin} calendarToken={(token as string) ?? ""} />
    {SCOUTBOOK_SYNC && <ScoutbookConnect orgId={current.org.id} canConnect={!!sbCan.data} connection={(sbConn.data ?? null) as never} />}
    <LinkedUnits orgId={current.org.id} joinCode={current.org.join_code} links={(links ?? []) as never} isAdmin={isAdmin} />
  </>;
}

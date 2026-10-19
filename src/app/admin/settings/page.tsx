import { requireStaff } from "@/lib/context";
import UnitSettings from "./UnitSettings";
import LinkedUnits from "./LinkedUnits";

export default async function UnitSettingsPage() {
  const { supabase, current, isAdmin } = await requireStaff();
  const { data: org } = await supabase.from("organizations").select("id, name, unit_number, city, state, settings, second_approval_cents, slug").eq("id", current.org.id).single();
  const [{ data: token }, { data: links }] = await Promise.all([
    supabase.rpc("org_calendar_token", { p_org: current.org.id }),
    supabase.rpc("linked_units", { p_org: current.org.id }),
  ]);
  return <>
    <UnitSettings org={org as never} isAdmin={isAdmin} calendarToken={(token as string) ?? ""} />
    <LinkedUnits orgId={current.org.id} joinCode={current.org.join_code} links={(links ?? []) as never} isAdmin={isAdmin} />
  </>;
}

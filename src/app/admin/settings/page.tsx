import { requireStaff } from "@/lib/context";
import UnitSettings from "./UnitSettings";

export default async function UnitSettingsPage() {
  const { supabase, current, isAdmin } = await requireStaff();
  const { data: org } = await supabase.from("organizations").select("id, name, unit_number, city, state, settings, second_approval_cents, slug").eq("id", current.org.id).single();
  const { data: token } = await supabase.rpc("org_calendar_token", { p_org: current.org.id });
  return <UnitSettings org={org as never} isAdmin={isAdmin} calendarToken={(token as string) ?? ""} />;
}

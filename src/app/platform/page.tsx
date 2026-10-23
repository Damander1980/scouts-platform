import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlatformClient, { type Unit, type PersonRow } from "./PlatformClient";

// Platform owner view: every troop and every user. Names are first name + last initial only,
// and the database refuses anyone not in platform_owners (migration 0064).
export default async function PlatformPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: owner } = await supabase.rpc("am_platform_owner");
  if (!owner) redirect("/dashboard");
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") redirect("/two-step?next=/platform");

  const [{ data: units, error: e1 }, { data: people, error: e2 }] = await Promise.all([
    supabase.rpc("platform_units"),
    supabase.rpc("platform_people", { p_org: null }),
  ]);

  return <PlatformClient units={(units ?? []) as Unit[]} people={(people ?? []) as PersonRow[]} error={e1?.message ?? e2?.message ?? ""} />;
}

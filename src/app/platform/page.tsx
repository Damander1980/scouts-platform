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

  // The API returns at most 1000 rows per call, so people are read page by page.
  const allPeople = async () => {
    const PAGE = 1000;
    const rows: PersonRow[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase.rpc("platform_people", { p_org: null }).range(from, from + PAGE - 1);
      if (error) return { data: rows, error };
      rows.push(...((data ?? []) as PersonRow[]));
      if ((data ?? []).length < PAGE) return { data: rows, error: null };
    }
  };
  const [{ data: units, error: e1 }, { data: people, error: e2 }] = await Promise.all([
    supabase.rpc("platform_units"),
    allPeople(),
  ]);

  return <PlatformClient units={(units ?? []) as Unit[]} people={(people ?? []) as PersonRow[]} error={e1?.message ?? e2?.message ?? ""} />;
}

import { getContext } from "@/lib/context";
import WelcomeClient, { type FamilyPerson, type PendingJoin } from "./WelcomeClient";

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ step?: string; code?: string }> }) {
  const { step, code } = await searchParams;
  const ctx = await getContext();

  let family: FamilyPerson[] = [];
  let pending: PendingJoin[] = [];
  if (ctx.householdId) {
    const { data } = await ctx.supabase
      .from("household_members")
      .select("persons(id, first_name, last_name, type, birthdate)")
      .eq("household_id", ctx.householdId);
    family = (data ?? []).map((r) => r.persons as unknown as FamilyPerson).filter(Boolean);
  }
  if (ctx.person) {
    const { data } = await ctx.supabase.rpc("my_pending_joins");
    pending = (data ?? []) as PendingJoin[];
  }

  const needsProfile = !ctx.person || !ctx.householdId;
  const initialStep = needsProfile ? "name" : step === "troop" || code ? "troop" : "family";

  return (
    <WelcomeClient
      initialStep={initialStep}
      person={ctx.person}
      family={family}
      pending={pending}
      hasTroop={!!ctx.current}
      inviteCode={code ?? ""}
    />
  );
}

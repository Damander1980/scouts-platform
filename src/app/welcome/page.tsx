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
      .select("persons(id, first_name, last_name, type)")
      .eq("household_id", ctx.householdId);
    const people = (data ?? []).map((r) => r.persons as unknown as Omit<FamilyPerson, "birthdate">).filter(Boolean);
    // Birthdates are private columns; a family reads its own through person_private.
    const { data: priv } = people.length
      ? await ctx.supabase.rpc("person_private", { p_org: null, p_ids: people.map((p) => p.id) })
      : { data: [] };
    const born = Object.fromEntries(((priv ?? []) as { id: string; birthdate: string | null }[]).map((r) => [r.id, r.birthdate]));
    family = people.map((p) => ({ ...p, birthdate: born[p.id] ?? null }));
  }
  if (ctx.person) {
    const { data } = await ctx.supabase.rpc("my_pending_joins");
    pending = (data ?? []) as PendingJoin[];
  }

  const needsProfile = !ctx.person || !ctx.householdId;
  // An invite link goes to the troop step, unless the family has no Scouts listed yet: then "add your
  // kids" first (the join page promises it), so the request covers them too. The code is kept either way.
  const hasYouth = family.some((p) => p.type === "youth");
  const initialStep = needsProfile ? "name" : step === "troop" || (code && hasYouth) ? "troop" : "family";

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

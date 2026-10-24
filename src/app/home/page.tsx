import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";

export default async function HomeRouter() {
  // A child signing in with the email their parent registered is linked to their own record here.
  await (await createClient()).rpc("link_child_login");
  const ctx = await getContext();
  if (!ctx.person || !ctx.householdId) redirect("/welcome");
  if (!ctx.current) redirect("/welcome?step=troop");
  // The people running the troop start on the Leader Overview unless they last switched to Family view
  // (many leaders also have Scouts in the troop).
  const view = (await cookies()).get("otm-view")?.value;
  redirect(ctx.isStaff && view !== "family" ? "/admin" : "/dashboard");
}

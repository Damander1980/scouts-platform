import { redirect } from "next/navigation";
import { getContext } from "@/lib/context";

export default async function HomeRouter() {
  const ctx = await getContext();
  if (!ctx.person || !ctx.householdId) redirect("/welcome");
  if (!ctx.current) redirect("/welcome?step=troop");
  redirect("/dashboard");
}

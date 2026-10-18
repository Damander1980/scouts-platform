import { requireOrg } from "@/lib/context";
import Shell from "@/components/Shell";
import { PageTitle } from "@/components/ui";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const ctx = await requireOrg();
  const { data: prefs } = await ctx.supabase.from("notification_prefs").select("*").eq("person_id", ctx.person.id).maybeSingle();
  const { data: counts } = await ctx.supabase.from("notification_log").select("id").eq("person_id", ctx.person.id)
    .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());
  return (
    <Shell ctx={ctx}>
      <PageTitle title="Settings" sub="How and when we contact you." />
      <SettingsClient person={ctx.person} email={ctx.user.email ?? ""} prefs={prefs} weekCount={(counts ?? []).length} />
    </Shell>
  );
}

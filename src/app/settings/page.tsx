import { requireOrg } from "@/lib/context";
import Shell from "@/components/Shell";
import { PageTitle } from "@/components/ui";
import SettingsClient from "./SettingsClient";
import SkillsCard from "./SkillsCard";

export default async function SettingsPage() {
  const ctx = await requireOrg();
  const { data: prefs } = await ctx.supabase.from("notification_prefs").select("*").eq("person_id", ctx.person.id).maybeSingle();
  const { data: counts } = await ctx.supabase.from("notification_log").select("id").eq("person_id", ctx.person.id)
    .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());
  const [{ data: me }, { data: skills }] = await Promise.all([
    ctx.supabase.from("persons").select("type").eq("id", ctx.person.id).maybeSingle(),
    ctx.supabase.from("adult_skills").select("skills, other, can_drive").eq("org_id", ctx.current.org.id).eq("person_id", ctx.person.id).maybeSingle(),
  ]);
  return (
    <Shell ctx={ctx}>
      <PageTitle title="Settings" sub="How and when we contact you." />
      <SettingsClient person={ctx.person} email={ctx.user.email ?? ""} prefs={prefs} weekCount={(counts ?? []).length} />
      {me?.type === "adult" && <SkillsCard orgId={ctx.current.org.id} personId={ctx.person.id} unitName={ctx.current.org.name} initial={skills ?? null} />}
    </Shell>
  );
}

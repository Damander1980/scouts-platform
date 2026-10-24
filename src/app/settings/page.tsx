import { requireOrg } from "@/lib/context";
import Shell from "@/components/Shell";
import { PageTitle } from "@/components/ui";
import SettingsClient from "./SettingsClient";
import SkillsCard from "./SkillsCard";
import TwoStepCard from "./TwoStepCard";

export default async function SettingsPage() {
  const ctx = await requireOrg();
  const [{ data: prefs }, { count: weekCount }, { data: skills }] = await Promise.all([
    ctx.supabase.from("notification_prefs").select("*").eq("person_id", ctx.person.id).maybeSingle(),
    ctx.supabase.from("notification_log").select("id", { count: "exact", head: true }).eq("person_id", ctx.person.id)
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
    ctx.supabase.from("adult_skills").select("skills, other, can_drive").eq("org_id", ctx.current.org.id).eq("person_id", ctx.person.id).maybeSingle(),
  ]);
  return (
    <Shell ctx={ctx}>
      <PageTitle title="Settings" sub="How and when we contact you." />
      <SettingsClient person={ctx.person} email={ctx.user.email ?? ""} prefs={prefs} weekCount={weekCount ?? 0} />
      {ctx.isStaff && <TwoStepCard />}
      {ctx.person.type === "adult" && <SkillsCard orgId={ctx.current.org.id} personId={ctx.person.id} unitName={ctx.current.org.name} initial={skills ?? null} />}
    </Shell>
  );
}

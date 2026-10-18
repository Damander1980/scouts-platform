import { requireOrg } from "@/lib/context";
import Shell from "@/components/Shell";
import { Chip, PageTitle, SectionLabel } from "@/components/ui";
import { loadFamily } from "@/lib/family";
import SignPermission from "./SignPermission";

export default async function FormsPage() {
  const ctx = await requireOrg();
  const { supabase, current } = ctx;
  const orgId = current.org.id;
  const family = (await loadFamily(supabase, orgId)).filter((f) => f.in_org);
  const ids = family.map((f) => f.id);
  const [{ data: forms }, { data: docs }] = await Promise.all([
    ids.length ? supabase.from("forms").select("person_id, type, expires_at, signed_at").eq("org_id", orgId).in("person_id", ids) : Promise.resolve({ data: [] }),
    supabase.from("documents").select("id, title, url, category").eq("org_id", orgId).order("category").order("title"),
  ]);

  const st = (pid: string, type: string) => {
    const f = (forms ?? []).find((x) => x.person_id === pid && x.type === type);
    if (!f) return { tone: "orange" as const, label: "Needed" };
    if (f.expires_at && new Date(f.expires_at) < new Date()) return { tone: "red" as const, label: "Expired" };
    return { tone: "green" as const, label: f.expires_at ? `Good to ${new Date(f.expires_at).toLocaleDateString()}` : "On file" };
  };

  return (
    <Shell ctx={ctx}>
      <PageTitle title="Forms" sub="See what's on file for your family and download blank forms." />

      <section className="flex flex-col gap-2">
        <SectionLabel>Your family</SectionLabel>
        {family.map((p) => (
          <div key={p.id} className="card flex flex-col gap-2">
            <div className="font-bold text-[16px]">{p.first_name} {p.last_name}</div>
            <div className="flex gap-1.5 flex-wrap">
              <Chip tone={st(p.id, "health_ab").tone}>Health A+B: {st(p.id, "health_ab").label}</Chip>
              <Chip tone={st(p.id, "health_c").tone}>Health C: {st(p.id, "health_c").label}</Chip>
              <Chip tone={st(p.id, "permission").tone}>Annual permission: {st(p.id, "permission").label}</Chip>
            </div>
            {p.type === "youth" && st(p.id, "permission").tone !== "green" && <SignPermission orgId={orgId} personId={p.id} name={p.first_name} />}
          </div>
        ))}
        <p className="text-[13px] text-smoke m-0">
          Health forms: fill out the paper form and give it to your troop&apos;s designated leader. Part C needs a doctor&apos;s exam and is required for events over 72 hours.
          A leader marks it received here; the form itself is never uploaded.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <SectionLabel>Blank forms</SectionLabel>
        <a className="card no-underline text-ink font-bold" href="https://www.scouting.org/health-and-safety/ahmr/" target="_blank" rel="noopener noreferrer">
          Annual Health and Medical Record (Scouting America) ↗
        </a>
        {(docs ?? []).map((d) => (
          <a key={d.id} className="card no-underline text-ink flex justify-between" href={d.url} target="_blank" rel="noopener noreferrer">
            <span className="font-bold">{d.title}</span>{d.category && <Chip>{d.category}</Chip>}
          </a>
        ))}
      </section>
    </Shell>
  );
}

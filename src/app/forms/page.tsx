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
        <div className="card p-0 overflow-x-auto">
          <table className="w-full border-collapse min-w-[560px]">
            <thead>
              <tr className="text-left text-[12px] uppercase tracking-widest text-smoke" style={{ background: "#F8F5EE" }}>
                <th scope="col" className="px-5 py-3 font-bold">Name</th>
                <th scope="col" className="px-3 py-3 font-bold">Health A and B</th>
                <th scope="col" className="px-3 py-3 font-bold">Health C</th>
                <th scope="col" className="px-3 py-3 font-bold">Permission slip</th>
              </tr>
            </thead>
            <tbody>
              {family.map((p) => (
                <tr key={p.id} className="border-t border-[#EAE4D6] align-top">
                  <th scope="row" className="px-5 py-3.5 text-left text-[15px] font-bold">{p.first_name} {p.last_name}</th>
                  <td className="px-3 py-3.5"><Chip tone={st(p.id, "health_ab").tone}>{st(p.id, "health_ab").label}</Chip></td>
                  <td className="px-3 py-3.5"><Chip tone={st(p.id, "health_c").tone}>{st(p.id, "health_c").label}</Chip></td>
                  <td className="px-3 py-3.5">
                    {p.type === "youth"
                      ? (st(p.id, "permission").tone !== "green" ? <SignPermission orgId={orgId} personId={p.id} name={p.first_name} /> : <Chip tone="green">{st(p.id, "permission").label}</Chip>)
                      : <span className="text-[13px] text-smoke">Not needed</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[13px] text-smoke m-0">
          Health forms: fill out the paper form and hand it to your troop&apos;s designated leader, who marks it received here. The form itself is never uploaded. Part C needs a doctor&apos;s exam and is required for events over 72 hours.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <SectionLabel>Blank forms</SectionLabel>
        <div className="card p-0 overflow-hidden">
          <a className="flex items-center justify-between gap-3 px-5 min-h-[56px] no-underline text-ink border-b border-[#EAE4D6] last:border-0" href="https://www.scouting.org/health-and-safety/ahmr/" target="_blank" rel="noopener noreferrer">
            <span className="font-bold text-[15px]">Annual Health and Medical Record</span><span className="text-[13px] font-bold text-forest">Scouting America ↗</span>
          </a>
          {(docs ?? []).map((d) => (
            <a key={d.id} className="flex items-center justify-between gap-3 px-5 min-h-[56px] no-underline text-ink border-b border-[#EAE4D6] last:border-0" href={d.url} target="_blank" rel="noopener noreferrer">
              <span className="font-bold text-[15px]">{d.title}</span>{d.category && <Chip>{d.category}</Chip>}
            </a>
          ))}
        </div>
      </section>
    </Shell>
  );
}

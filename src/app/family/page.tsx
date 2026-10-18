import Link from "next/link";
import { requireOrg, ROLE_LABELS } from "@/lib/context";
import Shell from "@/components/Shell";
import { Chip, LinkButton, PageTitle, SectionLabel, money } from "@/components/ui";
import { householdBalance, loadFamily } from "@/lib/family";
import FamilyTools from "./FamilyTools";

function age(b: string | null) {
  if (!b) return null;
  const d = new Date(b), n = new Date();
  return n.getFullYear() - d.getFullYear() - (n < new Date(n.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
}

export default async function FamilyPage() {
  const ctx = await requireOrg();
  const { supabase, current, householdId } = ctx;
  const orgId = current.org.id;
  const [family, balance] = await Promise.all([loadFamily(supabase, orgId), householdBalance(supabase, householdId, orgId)]);

  const ids = family.map((f) => f.id);
  const [{ data: forms }, { data: certs }] = await Promise.all([
    supabase.from("forms").select("person_id, type, expires_at").eq("org_id", orgId).in("person_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("scout_certifications").select("person_id, status, certifications(name)").eq("org_id", orgId).in("person_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
  ]);

  const formChip = (pid: string, type: string, label: string) => {
    const f = (forms ?? []).find((x) => x.person_id === pid && x.type === type);
    if (!f) return <Chip tone="orange">{label} needed</Chip>;
    if (f.expires_at && new Date(f.expires_at) < new Date()) return <Chip tone="red">{label} expired</Chip>;
    return <Chip tone="green">{label} on file</Chip>;
  };

  return (
    <Shell ctx={ctx}>
      <PageTitle title="Family" sub="Everyone in your household, their troop roles, forms and progress." />

      <div className="card flex items-center justify-between gap-3">
        <div>
          <div className="text-[12px] font-bold uppercase tracking-widest text-smoke">Family balance</div>
          <div className="font-display font-extrabold text-[26px]" style={{ color: balance > 0 ? "#7A2E00" : "#1F5F4A" }}>
            {balance > 0 ? `${money(balance)} owed` : balance < 0 ? `${money(-balance)} credit` : "Paid up"}
          </div>
        </div>
        <LinkButton href="/pay" variant={balance > 0 ? "primary" : "secondary"}>{balance > 0 ? "Pay" : "History"}</LinkButton>
      </div>

      <section className="flex flex-col gap-2">
        <SectionLabel>People</SectionLabel>
        {family.map((p) => {
          const a = age(p.birthdate);
          const myCerts = (certs ?? []).filter((c) => c.person_id === p.id && c.status === "active");
          return (
            <div key={p.id} className="card flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ background: p.type === "youth" ? "#1F5F4A" : "#4D5F57" }}>{p.first_name[0]}{p.last_name[0] ?? ""}</div>
                <div className="flex-1">
                  <div className="font-bold text-[16px]">{p.first_name} {p.last_name}</div>
                  <div className="text-[13px] text-smoke">
                    {p.type === "youth" ? `Youth${a !== null ? `, age ${a}` : ""}` : "Adult"}
                    {p.in_org ? ` · ${ROLE_LABELS[p.role ?? ""] ?? p.role}` : " · not in this unit"}
                  </div>
                </div>
                {p.type === "youth" && p.in_org && (
                  <Link href={`/scout/${p.id}/advancement`} className="text-[13px] font-bold text-forest no-underline">Advancement</Link>
                )}
              </div>
              {p.in_org && (
                <div className="flex gap-1.5 flex-wrap">
                  {formChip(p.id, "health_ab", "Health A+B")}
                  {formChip(p.id, "health_c", "Health C")}
                  {formChip(p.id, "permission", "Permission")}
                  {myCerts.map((c, i) => <Chip key={i} tone="green">{(c.certifications as unknown as { name: string })?.name}</Chip>)}
                  {p.type === "youth" && a !== null && a >= 18 && <Chip tone="orange">Turned 18: ask a leader to update role</Chip>}
                </div>
              )}
            </div>
          );
        })}
      </section>

      <FamilyTools defaultLast={family.find((f) => f.type === "adult")?.last_name ?? ""} notInTroop={family.filter((f) => !f.in_org).map((f) => ({ id: f.id, name: f.first_name }))} orgId={orgId} />

      <section className="card flex flex-col gap-2">
        <div className="font-bold text-[15px]">Blank forms</div>
        <p className="text-[13px] text-smoke m-0">
          Download, fill out, and hand the paper form to your troop&apos;s designated leader. Completed medical forms are never uploaded here,
          following Scouting America guidance; a leader marks them received.
        </p>
        <div className="flex gap-2 flex-wrap">
          <a className="btn-secondary no-underline" href="https://www.scouting.org/health-and-safety/ahmr/" target="_blank" rel="noopener noreferrer">Health and Medical Record</a>
          <Link className="btn-secondary no-underline" href="/forms">Troop forms</Link>
        </div>
      </section>
    </Shell>
  );
}

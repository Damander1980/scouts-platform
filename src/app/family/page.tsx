import Link from "next/link";
import { requireOrg, ROLE_LABELS } from "@/lib/context";
import Shell from "@/components/Shell";
import { Chip, LinkButton, PageTitle, SectionLabel, money, ageFrom } from "@/components/ui";
import { householdBalance, loadFamily } from "@/lib/family";
import FamilyTools from "./FamilyTools";
import PhotoConsent from "./PhotoConsent";
import ChildLogin from "./ChildLogin";
import AboutPerson from "./AboutPerson";

const age = ageFrom;

export default async function FamilyPage() {
  const ctx = await requireOrg();
  const { supabase, current, householdId } = ctx;
  const orgId = current.org.id;
  const [family, balance] = await Promise.all([loadFamily(supabase, orgId), householdBalance(supabase, householdId, orgId)]);

  const ids = family.map((f) => f.id);
  // Independent lookups for the family, run together.
  const none = Promise.resolve({ data: [] as never[] });
  const [{ data: certs }, { data: consents }, { data: idRows }, { data: logins }] = ids.length ? await Promise.all([
    supabase.from("scout_certifications").select("person_id, status, certifications(name)").eq("org_id", orgId).in("person_id", ids),
    supabase.from("persons").select("id, photo_consent").in("id", ids),
    supabase.rpc("person_identity", { p_org: orgId, p_ids: ids }),
    supabase.rpc("child_login_status", { p_ids: ids }),
  ]) : await Promise.all([none, none, none, none]);
  const consentOf = Object.fromEntries((consents ?? []).map((c) => [c.id, c.photo_consent as boolean | null]));

  const identityOf = Object.fromEntries(((idRows ?? []) as { id: string; nickname: string | null; pronouns: string | null; registered_gender: string | null; accommodation_note: string | null }[])
    .map((r) => [r.id, { nickname: r.nickname ?? "", pronouns: r.pronouns ?? "", gender: (r.registered_gender ?? "") as "" | "male" | "female", note: r.accommodation_note ?? "" }]));

  const loginOf = Object.fromEntries(((logins ?? []) as { person_id: string; email: string | null; linked: boolean }[]).map((l) => [l.person_id, l]));

  return (
    <Shell ctx={ctx}>
      <PageTitle title="Family" sub="Everyone in your household, their logins and photo choices. Form status is on the Forms page." />

      <div className="card flex items-center justify-between gap-3">
        <div>
          <div className="eyebrow text-smoke">Family balance</div>
          <div className="font-display font-extrabold text-[26px]" style={{ color: balance > 0 ? "#5E4400" : "#12355F" }}>
            {balance > 0 ? `${money(balance)} owed` : balance < 0 ? `${money(-balance)} credit` : "Paid up"}
          </div>
        </div>
        <LinkButton href="/pay" variant={balance > 0 ? "primary" : "secondary"}>{balance > 0 ? "Pay" : "History"}</LinkButton>
      </div>

      <section className="flex flex-col gap-2">
        <SectionLabel>People</SectionLabel>
        <div className="grid gap-5 md:grid-cols-2 items-start">
        {family.map((p) => {
          const a = age(p.birthdate);
          const myCerts = (certs ?? []).filter((c) => c.person_id === p.id && c.status === "active");
          return (
            <div key={p.id} className="card flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ background: p.type === "youth" ? "#12355F" : "#4B5568" }}>{p.first_name[0]}{p.last_name[0] ?? ""}</div>
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
              {p.in_org && (myCerts.length > 0 || (p.type === "youth" && a !== null && a >= 18)) && (
                <div className="flex gap-1.5 flex-wrap">
                  {myCerts.map((c, i) => <Chip key={i} tone="green">{(c.certifications as unknown as { name: string })?.name}</Chip>)}
                  {p.type === "youth" && a !== null && a >= 18 && <Chip tone="orange">Turned 18: ask a leader to update role</Chip>}
                </div>
              )}
              <AboutPerson orgId={orgId} personId={p.id} name={p.first_name} youth={p.type === "youth"}
                initial={identityOf[p.id] ?? { nickname: "", pronouns: "", gender: "", note: "" }} />
              {p.type === "youth" && <ChildLogin personId={p.id} name={p.first_name} age={a} email={loginOf[p.id]?.email ?? null} linked={!!loginOf[p.id]?.linked} />}
              {p.type === "youth" && <PhotoConsent personId={p.id} name={p.first_name} initial={consentOf[p.id] ?? null} />}
            </div>
          );
        })}
        </div>
      </section>

      <FamilyTools defaultLast={family.find((f) => f.type === "adult")?.last_name ?? ""} notInTroop={family.filter((f) => !f.in_org).map((f) => ({ id: f.id, name: f.first_name }))} orgId={orgId} />

    </Shell>
  );
}

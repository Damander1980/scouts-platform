import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm, ROLE_LABELS } from "@/lib/context";
import Shell from "@/components/Shell";
import { Chip, PageTitle, SectionLabel, fmtDate, isoDay, money } from "@/components/ui";
import { householdBalance } from "@/lib/family";

const FORM_LABEL: [string, string][] = [["health_ab", "Health A+B"], ["health_c", "Health C"], ["tetanus", "Tetanus"], ["swim_check", "Swim check"], ["permission", "Permission slip"]];
const SWIM: Record<string, string> = { swimmer: "Swimmer", beginner: "Beginner", nonswimmer: "Non-swimmer" };

function age(b: string | null) {
  if (!b) return null;
  const d = new Date(b), n = new Date();
  return n.getFullYear() - d.getFullYear() - (n < new Date(n.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
}

// One page per member for leaders: who they are, where they stand, and what's due. Each block only
// appears for leaders whose position allows it (private details, health status, money).
export default async function ScoutOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePerm("leader");
  const { supabase, current } = ctx;
  const orgId = current.org.id;
  const canPrivate = ctx.can("members.private");
  const canMedical = ctx.can("medical.view", "medical.record");
  const canMoney = ctx.can("money.view");

  const { data: m } = await supabase.from("memberships")
    .select("role, status, position, ypt_expires, swim_class, joined_at, persons(id, first_name, last_name, type)")
    .eq("org_id", orgId).eq("person_id", id).maybeSingle();
  if (!m) notFound();
  const p = m.persons as unknown as { id: string; first_name: string; last_name: string; type: string };

  const [{ data: patrol }, { data: positions }, { data: rankRows }, { data: forms }, { data: hh }, { data: priv }, { data: att }, { data: certs }] = await Promise.all([
    supabase.from("patrol_members").select("role, patrols(name)").eq("org_id", orgId).eq("person_id", id).is("end_date", null).maybeSingle(),
    supabase.from("leadership_positions").select("title, start_date, end_date").eq("org_id", orgId).eq("person_id", id).order("start_date", { ascending: false }),
    supabase.from("scout_advancement").select("status, completed_at, advancement_items(name, kind)").eq("person_id", id),
    canMedical ? supabase.from("forms").select("type, expires_at").eq("org_id", orgId).eq("person_id", id) : Promise.resolve({ data: [] }),
    supabase.from("household_members").select("household_id, households!inner(org_id)").eq("person_id", id).eq("households.org_id", orgId),
    canPrivate ? supabase.rpc("person_private", { p_org: orgId, p_ids: [id] }).maybeSingle<{ birthdate: string | null }>() : Promise.resolve({ data: null }),
    supabase.from("attendance").select("confirmed, method, events(kind, overnight_nights, service_hours, miles, canceled)").eq("org_id", orgId).eq("person_id", id).eq("present", true),
    supabase.from("scout_certifications").select("status, certifications(name)").eq("org_id", orgId).eq("person_id", id),
  ]);

  const householdIds = ((hh ?? []) as { household_id: string }[]).map((h) => h.household_id);
  const { data: members } = householdIds.length
    ? await supabase.from("household_members").select("household_id, person_id, is_guardian, persons(first_name, last_name)").in("household_id", householdIds)
    : { data: [] };
  const guardians = ((members ?? []) as unknown as { person_id: string; is_guardian: boolean; persons: { first_name: string; last_name: string } }[])
    .filter((x) => x.is_guardian && x.person_id !== id);
  // The family this unit bills (a Scout can be in a second household, or one in a linked unit).
  const { data: billedHousehold } = canMoney ? await supabase.rpc("person_household_in", { pid: id, org: orgId }) : { data: null };
  const balance = canMoney && billedHousehold ? await householdBalance(supabase, billedHousehold as string, orgId) : null;

  const ranks = ((rankRows ?? []) as unknown as { status: string; completed_at: string | null; advancement_items: { name: string; kind: string } | null }[])
    .filter((r) => r.advancement_items?.kind === "rank" && r.status === "completed")
    .sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)));
  const badgesEarned = ((rankRows ?? []) as unknown as { status: string; advancement_items: { kind: string } | null }[])
    .filter((r) => r.advancement_items?.kind === "badge" && r.status === "completed").length;

  // Same rule as the attendance report: a QR self check-in counts only once a leader confirms it.
  type Ev = { kind: string; overnight_nights: number; service_hours: number; miles: number; canceled: boolean };
  const events = ((att ?? []) as unknown as { confirmed: boolean | null; method: string | null; events: Ev | null }[])
    .filter((a) => a.confirmed !== false || (a.method ?? "") !== "qr").map((a) => a.events).filter((e): e is Ev => !!e && !e.canceled);
  const nights = events.filter((e) => e.kind !== "service").reduce((s, e) => s + Number(e.overnight_nights || 0), 0);
  const service = events.reduce((s, e) => s + Number(e.service_hours || 0), 0);

  const today = isoDay();
  const formChip = (type: string) => {
    const f = ((forms ?? []) as { type: string; expires_at: string | null }[]).find((x) => x.type === type);
    if (!f) return <Chip tone="orange">Needed</Chip>;
    const exp = f.expires_at?.slice(0, 10) ?? null;
    if (exp && exp < today) return <Chip tone="red">Expired {fmtDate(exp + "T12:00:00", { month: "short", year: "numeric" })}</Chip>;
    return <Chip tone="green">{exp ? `To ${fmtDate(exp + "T12:00:00", { month: "short", year: "numeric" })}` : "On file"}</Chip>;
  };
  const born = (priv as { birthdate: string | null } | null)?.birthdate ?? null;
  const a = age(born);
  const patrolName = (patrol?.patrols as unknown as { name: string } | null)?.name;

  return (
    <Shell ctx={ctx}>
      <PageTitle title={`${p.first_name} ${p.last_name}`}
        sub={[ROLE_LABELS[m.role] ?? m.role, patrolName, p.type === "youth" && a !== null ? `age ${a}` : null, m.status !== "active" ? "inactive" : null].filter(Boolean).join(" · ")}
        action={p.type === "youth" ? <Link href={`/scout/${id}/advancement`} className="btn-primary no-underline">Open advancement</Link> : undefined} />

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card flex flex-col gap-2">
          <SectionLabel>Progress</SectionLabel>
          <div className="text-[15px]">Rank: <b>{ranks[0]?.advancement_items?.name ?? (p.type === "youth" ? "Not yet earned" : "—")}</b></div>
          {p.type === "youth" && (
            <>
              <div className="text-[15px]">Merit badges earned: <b>{badgesEarned}</b></div>
              <div className="text-[15px]">Nights camped: <b>{nights}</b> · Service hours: <b>{service}</b></div>
            </>
          )}
          {(positions ?? []).length > 0 && (
            <div className="flex flex-col gap-1 pt-1">
              {(positions ?? []).map((x, i) => (
                <div key={i} className="text-[14px]"><b>{x.title}</b> <span className="text-smoke">{fmtDate(x.start_date + "T12:00:00", { month: "short", year: "numeric" })} – {x.end_date ? fmtDate(x.end_date + "T12:00:00", { month: "short", year: "numeric" }) : "now"}</span></div>
              ))}
            </div>
          )}
          {(certs ?? []).length > 0 && (
            <div className="flex gap-1.5 flex-wrap pt-1">
              {((certs ?? []) as unknown as { status: string; certifications: { name: string } }[]).map((c, i) => (
                <Chip key={i} tone={c.status === "active" ? "green" : "orange"}>{c.certifications?.name}{c.status !== "active" ? ` (${c.status})` : ""}</Chip>
              ))}
            </div>
          )}
        </div>

        <div className="card flex flex-col gap-2">
          <SectionLabel>Family</SectionLabel>
          {guardians.length === 0 && <div className="text-[14px] text-smoke">No parent or guardian linked yet.</div>}
          {guardians.map((g) => <div key={g.person_id} className="text-[15px]">{g.persons.first_name} {g.persons.last_name}</div>)}
          {balance !== null && (
            <div className="text-[15px] pt-1">Family balance: <b style={{ color: balance > 0 ? "#5E4400" : "#12355F" }}>
              {balance > 0 ? `${money(balance)} owed` : balance < 0 ? `${money(-balance)} credit` : "Paid up"}</b></div>
          )}
        </div>

        {canMedical && (
          <div className="card flex flex-col gap-2">
            <SectionLabel>Health and forms</SectionLabel>
            <div className="flex gap-1.5 flex-wrap">
              {FORM_LABEL.map(([t, label]) => <span key={t} className="inline-flex items-center gap-1 text-[13px]">{label}: {formChip(t)}</span>)}
            </div>
            <div className="text-[14px]">Swim classification: <b>{m.swim_class ? SWIM[m.swim_class] ?? m.swim_class : "Not tested"}</b></div>
            <Link href="/admin/forms" className="text-[13px] font-bold text-forest no-underline">Record forms</Link>
          </div>
        )}

        {p.type === "adult" && (
          <div className="card flex flex-col gap-2">
            <SectionLabel>Leader status</SectionLabel>
            <div className="text-[15px]">Youth Protection Training: {m.ypt_expires
              ? (m.ypt_expires < today ? <Chip tone="red">Expired {fmtDate(m.ypt_expires + "T12:00:00", { month: "short", year: "numeric" })}</Chip> : <Chip tone="green">To {fmtDate(m.ypt_expires + "T12:00:00", { month: "short", year: "numeric" })}</Chip>)
              : <Chip tone="orange">Not recorded</Chip>}</div>
            {m.position && <div className="text-[15px]">Position: <b>{m.position}</b></div>}
          </div>
        )}
      </div>
    </Shell>
  );
}

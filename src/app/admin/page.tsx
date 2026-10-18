import Link from "next/link";
import { LEADER_ROLES, requireLeader } from "@/lib/context";
import { Chip, PageTitle, SectionLabel, Stat, fmtDate, money } from "@/components/ui";

export default async function AdminOverview() {
  const { supabase, current } = await requireLeader();
  const orgId = current.org.id;
  const now = new Date();
  const in60 = new Date(Date.now() + 60 * 86400000).toISOString();

  const [{ data: members }, { count: events }, { count: joins }, { count: signoffs }, { data: forms }, { data: ledger }] = await Promise.all([
    supabase.from("memberships").select("person_id, role, ypt_expires, is_admin, is_designated_leader, persons(first_name, last_name, type)").eq("org_id", orgId).eq("status", "active"),
    supabase.from("events").select("*", { count: "exact", head: true }).eq("org_id", orgId).gte("start_at", now.toISOString()).eq("canceled", false),
    supabase.from("join_requests").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "pending"),
    supabase.from("requirement_progress").select("*", { count: "exact", head: true }).eq("org_id", orgId).not("completed_at", "is", null).is("approved_by", null),
    supabase.from("forms").select("person_id, type, expires_at").eq("org_id", orgId).eq("type", "health_ab"),
    supabase.from("ledger_entries").select("household_id, amount_cents").eq("org_id", orgId),
  ]);

  type M = { person_id: string; role: string; ypt_expires: string | null; is_admin: boolean; is_designated_leader: boolean; persons: { first_name: string; last_name: string; type: string } };
  const ms = (members ?? []) as unknown as M[];
  const youth = ms.filter((m) => m.persons.type === "youth");
  const leaders = ms.filter((m) => LEADER_ROLES.includes(m.role));
  const yptIssues = leaders.filter((m) => !m.ypt_expires || m.ypt_expires < in60);
  const noHealth = ms.filter((m) => !(forms ?? []).some((f) => f.person_id === m.person_id && (!f.expires_at || new Date(f.expires_at) > now)));
  const owed = Object.values((ledger ?? []).reduce<Record<string, number>>((a, r) => ({ ...a, [r.household_id]: (a[r.household_id] ?? 0) + r.amount_cents }), {}))
    .filter((v) => v > 0).reduce((s, v) => s + v, 0);
  const designated = ms.filter((m) => m.is_designated_leader).length;
  const admins = ms.filter((m) => m.is_admin).length;

  const setup = [
    { done: admins >= 2, label: "Add a second admin (a unit must never depend on one person)", href: "/admin/members" },
    { done: designated >= 2, label: "Choose at least two designated leaders (they're copied on every message to a Scout)", href: "/admin/members" },
    { done: youth.length > 0, label: "Add or import your Scouts", href: "/admin/import" },
    { done: (events ?? 0) > 0, label: "Post your first event", href: "/events/new" },
  ].filter((s) => !s.done);

  return (
    <>
      <PageTitle title="Overview" sub={`${current.org.name} at a glance`} />

      {setup.length > 0 && (
        <section className="card flex flex-col gap-2" style={{ background: "#FFF1E6", borderColor: "#FFD6B8" }}>
          <div className="font-bold text-[16px]">Finish setting up</div>
          {setup.map((s) => (
            <Link key={s.label} href={s.href} className="text-[14px] text-ink no-underline flex items-center gap-2">
              <span className="w-5 h-5 rounded-full border-2 border-orange-dark flex-none" /> {s.label}
            </Link>
          ))}
        </section>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Scouts" value={youth.length} />
        <Stat label="Adults" value={ms.length - youth.length} />
        <Stat label="Upcoming events" value={events ?? 0} />
        <Stat label="Owed to unit" value={money(owed)} tone={owed > 0 ? "#7A2E00" : undefined} />
      </div>

      <section className="flex flex-col gap-2">
        <SectionLabel>Needs attention</SectionLabel>
        {(joins ?? 0) > 0 && <Link href="/admin/members?tab=requests" className="card flex justify-between no-underline text-ink"><b>Join requests</b><Chip tone="dark">{joins}</Chip></Link>}
        {(signoffs ?? 0) > 0 && <Link href="/admin/advancement" className="card flex justify-between no-underline text-ink"><b>Requirements waiting for sign-off</b><Chip tone="dark">{signoffs}</Chip></Link>}
        {noHealth.length > 0 && <Link href="/admin/forms" className="card flex justify-between no-underline text-ink"><b>Members without a current health form (A+B)</b><Chip tone="orange">{noHealth.length}</Chip></Link>}
        {yptIssues.length > 0 && (
          <Link href="/admin/forms" className="card flex flex-col gap-1 no-underline text-ink">
            <div className="flex justify-between"><b>Youth Protection Training missing or expiring within 60 days</b><Chip tone="red">{yptIssues.length}</Chip></div>
            <div className="text-[13px] text-smoke">{yptIssues.map((m) => `${m.persons.first_name} ${m.persons.last_name}${m.ypt_expires ? ` (${fmtDate(m.ypt_expires)})` : " (not recorded)"}`).join(", ")}</div>
          </Link>
        )}
        {!joins && !signoffs && !noHealth.length && !yptIssues.length && <div className="card text-smoke">Nothing needs attention.</div>}
      </section>
    </>
  );
}

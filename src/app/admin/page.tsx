import Link from "next/link";
import { LEADER_ROLES, requireStaff } from "@/lib/context";
import ScoutbookSync from "@/components/ScoutbookSync";
import { Chip, PageTitle, SectionLabel, Stat, fmtDate, money } from "@/components/ui";

export default async function AdminOverview() {
  const { supabase, current } = await requireStaff();
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

  const { data: nextEvents } = await supabase.from("events").select("id, title, start_at, end_at, location")
    .eq("org_id", orgId).gte("start_at", now.toISOString()).eq("canceled", false).order("start_at").limit(1);
  const next = nextEvents?.[0];
  const sb = await supabase.rpc("scoutbook_pending", { p_org: orgId });
  const { data: orgRow } = await supabase.from("organizations").select("stripe_account_id, settings").eq("id", orgId).single();
  const cashOnly = (orgRow?.settings as Record<string, unknown> | null)?.payment_methods === "cash";
  const { data: nextRsvps } = next ? await supabase.from("rsvps").select("status").eq("event_id", next.id) : { data: [] as { status: string }[] };
  const going = (nextRsvps ?? []).filter((r) => r.status === "yes" || r.status === "going").length;

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
    { done: youth.length > 0, label: "Import your roster from Scoutbook (or add Scouts by hand)", href: "/admin/import" },
    { done: (events ?? 0) > 0, label: "Post your first event", href: "/events/new" },
    { done: cashOnly || !!orgRow?.stripe_account_id, label: "Connect the troop's bank account so families can pay by card (or choose cash only in Unit settings)", href: "/admin/money" },
  ].filter((s) => !s.done);

  return (
    <>
      <PageTitle title="Overview" sub={`${current.org.name} at a glance`} />

      {setup.length > 0 && (
        <section className="card flex flex-col gap-2" style={{ background: "#FFF6D6", borderColor: "#F0DA8C" }}>
          <div className="font-bold text-[16px]">Finish setting up</div>
          {setup.map((s) => (
            <Link key={s.label} href={s.href} className="text-[14px] text-ink no-underline flex items-center gap-2">
              <span className="w-5 h-5 rounded-full border-2 border-orange-dark flex-none" /> {s.label}
            </Link>
          ))}
        </section>
      )}

      {next && (
        <Link href={`/events/${next.id}`} className="patch flex flex-wrap items-center gap-5 no-underline">
          <div className="flex-1 min-w-[240px] flex flex-col gap-1">
            <span className="eyebrow" style={{ color: "#F5B700" }}>Next up · {fmtDate(next.start_at, { weekday: "short", month: "short", day: "numeric" })}</span>
            <span className="font-display font-extrabold text-[26px] leading-tight">{next.title}</span>
            {next.location && <span className="text-[14px]" style={{ color: "#D7E0EE" }}>{next.location}</span>}
          </div>
          <div className="flex flex-col items-end">
            <span className="font-display font-extrabold text-[36px] leading-none">{going}</span>
            <span className="text-[13px]" style={{ color: "#D7E0EE" }}>going so far</span>
          </div>
          <span className="min-h-[44px] px-5 rounded-full font-bold text-[15px] flex items-center" style={{ background: "#F5B700", color: "#101B2D" }}>Open roster</span>
        </Link>
      )}

      <nav aria-label="Quick actions" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ["/events/new", "Post an event", "M12 5v14M5 12h14"],
          ["/messages/new?audience=troop", "Message the troop", "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"],
          ["/admin/money?tab=record", "Record cash or check", "M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"],
          ["/admin/advancement", "Sign off advancement", "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"],
        ].map(([href, label, icon]) => (
          <Link key={href} href={href} className="card !p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 no-underline text-ink min-h-[64px] min-w-0">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center text-forest flex-none" style={{ background: "#EEE8D9" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icon} /></svg>
            </span>
            <span className="font-bold text-[15px] leading-snug min-w-0">{label}</span>
          </Link>
        ))}
      </nav>

      <ScoutbookSync pending={sb.error ? null : (sb.data as number)} compact />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Scouts" value={youth.length} />
        <Stat label="Adults" value={ms.length - youth.length} />
        <Stat label="Upcoming events" value={events ?? 0} />
        <Stat label="Owed to unit" value={money(owed)} tone={owed > 0 ? "#5E4400" : undefined} />
      </div>

      <section className="flex flex-col gap-2">
        <SectionLabel>Needs attention</SectionLabel>
        <div className="card p-0 overflow-hidden flex flex-col [&>a]:rounded-none [&>a]:shadow-none [&>a]:border-b [&>a]:border-[#EAE4D6] [&>a:last-child]:border-0 [&>div]:shadow-none">
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
        </div>
      </section>
    </>
  );
}

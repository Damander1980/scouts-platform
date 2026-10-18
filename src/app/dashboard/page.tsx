import Link from "next/link";
import { requireOrg, unitWord } from "@/lib/context";
import Shell from "@/components/Shell";
import { Chip, Empty, LinkButton, SectionLabel, fmtDate, fmtTime, money } from "@/components/ui";
import { householdBalance, loadFamily } from "@/lib/family";

export default async function DashboardPage() {
  const ctx = await requireOrg();
  const { supabase, current, person, isLeader, householdId } = ctx;
  const orgId = current.org.id;

  const family = await loadFamily(supabase, orgId);
  const inTroop = family.filter((f) => f.in_org);
  const ids = inTroop.map((f) => f.id);

  const now = new Date().toISOString();
  const [{ data: events }, balance, { data: forms }] = await Promise.all([
    supabase.from("events").select("id, title, start_at, end_at, location, cost_cents, rsvp_deadline, kind")
      .eq("org_id", orgId).eq("canceled", false).gte("start_at", now).order("start_at").limit(8),
    householdBalance(supabase, householdId, orgId),
    ids.length ? supabase.from("forms").select("person_id, type, expires_at").eq("org_id", orgId).in("person_id", ids) : Promise.resolve({ data: [] }),
  ]);

  const eventIds = (events ?? []).map((e) => e.id);
  const { data: rsvps } = eventIds.length && ids.length
    ? await supabase.from("rsvps").select("event_id, person_id, status").in("event_id", eventIds).in("person_id", ids)
    : { data: [] as { event_id: string; person_id: string; status: string }[] };

  const rsvpFor = (eventId: string) => (rsvps ?? []).filter((r) => r.event_id === eventId);
  const needsAnswer = (events ?? []).filter((e) => rsvpFor(e.id).length < ids.length);

  // Annual health record: Parts A and B are needed for every activity; expiring within 30 days counts as due.
  const soon = Date.now() + 30 * 86400000;
  const formIssues = inTroop.flatMap((p) => {
    const mine = (forms ?? []).filter((f) => f.person_id === p.id);
    const out: string[] = [];
    for (const part of ["health_ab"]) {
      const f = mine.find((x) => x.type === part);
      if (!f) out.push(`${p.first_name}: health form Parts A and B needed`);
      else if (f.expires_at && new Date(f.expires_at).getTime() < soon) out.push(`${p.first_name}: health form expires ${fmtDate(f.expires_at)}`);
    }
    return out;
  });

  let leaderTodos: { label: string; href: string; count: number }[] = [];
  if (isLeader) {
    const [{ count: joins }, { count: signoffs }] = await Promise.all([
      supabase.from("join_requests").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "pending"),
      supabase.from("requirement_progress").select("*", { count: "exact", head: true }).eq("org_id", orgId).not("completed_at", "is", null).is("approved_by", null),
    ]);
    leaderTodos = [
      { label: "Families waiting to join", href: "/admin/members?tab=requests", count: joins ?? 0 },
      { label: "Requirements waiting for sign-off", href: "/admin/advancement", count: signoffs ?? 0 },
    ].filter((t) => t.count > 0);
  }

  const next = (events ?? [])[0];
  const word = unitWord(current.org.type);

  return (
    <Shell ctx={ctx}>
      <div>
        <h1 className="font-display font-extrabold text-[28px] leading-tight m-0">Hi, {person.first_name}.</h1>
        <p className="text-[15px] text-smoke m-0 mt-1">Here&apos;s what needs you in {word} {current.org.unit_number}.</p>
      </div>

      {(balance > 0 || formIssues.length > 0 || needsAnswer.length > 0 || leaderTodos.length > 0) ? (
        <section className="flex flex-col gap-2">
          <SectionLabel>Needs you</SectionLabel>
          {balance > 0 && (
            <div className="card flex items-center justify-between gap-3" style={{ background: "#FFF1E6", borderColor: "#FFD6B8" }}>
              <div>
                <div className="font-bold text-[16px]">You owe {money(balance)}</div>
                <div className="text-[13px] text-smoke">Family balance with the {word.toLowerCase()}</div>
              </div>
              <LinkButton href="/pay">Pay</LinkButton>
            </div>
          )}
          {needsAnswer.slice(0, 3).map((e) => (
            <Link key={e.id} href={`/events/${e.id}`} className="card flex items-center justify-between gap-3 no-underline text-ink">
              <div>
                <div className="font-bold text-[16px]">RSVP for {e.title}</div>
                <div className="text-[13px] text-smoke">
                  {fmtDate(e.start_at)}{e.rsvp_deadline ? ` · reply by ${fmtDate(e.rsvp_deadline)}` : ""}
                </div>
              </div>
              <span className="btn-primary">RSVP</span>
            </Link>
          ))}
          {formIssues.map((f) => (
            <Link key={f} href="/forms" className="card flex items-center justify-between gap-3 no-underline text-ink">
              <div className="font-bold text-[15px]">{f}</div>
              <Chip tone="orange">Form</Chip>
            </Link>
          ))}
          {leaderTodos.map((t) => (
            <Link key={t.href} href={t.href} className="card flex items-center justify-between gap-3 no-underline text-ink">
              <div className="font-bold text-[15px]">{t.label}</div>
              <Chip tone="dark">{t.count}</Chip>
            </Link>
          ))}
        </section>
      ) : (
        <div className="card" style={{ background: "#EAF0ED", borderColor: "#CFE3DA" }}>
          <div className="font-bold text-[16px]">You&apos;re all caught up.</div>
          <div className="text-[14px] text-smoke">No payments, forms or RSVPs waiting.</div>
        </div>
      )}

      {next && (
        <section className="flex flex-col gap-2">
          <SectionLabel>Next up</SectionLabel>
          <Link href={`/events/${next.id}`} className="card no-underline text-ink flex flex-col gap-2" style={{ borderColor: "#1F5F4A" }}>
            <div className="text-[13px] font-bold text-smoke">{fmtDate(next.start_at, { weekday: "long", month: "long", day: "numeric" })} · {fmtTime(next.start_at)}</div>
            <div className="font-display font-bold text-[22px]">{next.title}</div>
            {next.location && <div className="text-[14px] text-smoke">{next.location}</div>}
            <div className="flex gap-2 flex-wrap">
              {inTroop.map((p) => {
                const r = rsvpFor(next.id).find((x) => x.person_id === p.id);
                return <Chip key={p.id} tone={r?.status === "going" ? "green" : r ? "gray" : "orange"}>
                  {p.first_name}: {r?.status === "going" ? "Going" : r?.status === "not_going" ? "Not going" : r?.status === "waitlisted" ? "Waitlist" : "No reply"}
                </Chip>;
              })}
              {next.cost_cents > 0 && <Chip>{money(next.cost_cents)} each</Chip>}
            </div>
          </Link>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <SectionLabel action={<Link href="/events" className="text-[13px] font-bold text-forest no-underline">All events</Link>}>Coming up</SectionLabel>
        {(events ?? []).length <= 1 ? (
          <Empty>{(events ?? []).length === 0 ? (isLeader ? "No events yet. Add your first one from Events." : "No events on the calendar yet.") : "Nothing else scheduled yet."}</Empty>
        ) : (
          (events ?? []).slice(1).map((e) => (
            <Link key={e.id} href={`/events/${e.id}`} className="card flex items-center gap-3 no-underline text-ink">
              <div className="w-12 text-center flex-none">
                <div className="text-[11px] font-bold uppercase text-smoke">{fmtDate(e.start_at, { month: "short" })}</div>
                <div className="font-display font-extrabold text-[24px] leading-none">{new Date(e.start_at).getDate()}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[16px] truncate">{e.title}</div>
                <div className="text-[13px] text-smoke truncate">{fmtTime(e.start_at)}{e.location ? ` · ${e.location}` : ""}</div>
              </div>
              {e.cost_cents > 0 && <Chip>{money(e.cost_cents)}</Chip>}
            </Link>
          ))
        )}
      </section>

      {current.role === "merit_badge_counselor" && (
        <Link href="/counselor" className="card no-underline text-ink flex items-center justify-between">
          <div><div className="font-bold text-[16px]">Merit badge counselor</div><div className="text-[13px] text-smoke">Your Scouts and sign-offs</div></div>
          <Chip tone="dark">Open</Chip>
        </Link>
      )}

      <section className="grid grid-cols-2 gap-2">
        {inTroop.filter((p) => p.type === "youth").map((p) => (
          <Link key={p.id} href={`/scout/${p.id}/advancement`} className="card no-underline text-ink">
            <div className="text-[12px] font-bold uppercase tracking-widest text-smoke">Advancement</div>
            <div className="font-bold text-[16px] mt-1">{p.first_name}&apos;s ranks and badges</div>
          </Link>
        ))}
      </section>
    </Shell>
  );
}

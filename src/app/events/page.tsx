import Link from "next/link";
import { requireOrg } from "@/lib/context";
import Shell from "@/components/Shell";
import { Empty, LinkButton, PageTitle, dayOfMonth, fmtDate, fmtTime, money } from "@/components/ui";

const KIND_LABEL: Record<string, string> = {
  meeting: "Meeting", campout: "Campout", service: "Service", fundraiser: "Fundraiser", event: "Event", high_adventure: "High adventure",
};

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ past?: string }> }) {
  const { past } = await searchParams;
  const ctx = await requireOrg();
  const { supabase, current } = ctx;
  const isLeader = ctx.can("leader", "events.manage");
  const now = new Date().toISOString();

  let q = supabase.from("events").select("id, title, start_at, end_at, location, cost_cents, kind, canceled, cap")
    .eq("org_id", current.org.id);
  q = past ? q.lt("start_at", now).order("start_at", { ascending: false }).limit(50) : q.gte("start_at", now).order("start_at").limit(100);
  const [{ data: own }, { data: calToken }, { data: links }] = await Promise.all([
    q, supabase.rpc("org_calendar_token", { p_org: current.org.id }), supabase.rpc("linked_units", { p_org: current.org.id }),
  ]);

  // Events a linked unit chose to share. Shown read-only; sign-ups happen with the host unit.
  const linked = ((links ?? []) as { org_id: string; name: string; status: string }[]).filter((l) => l.status === "accepted");
  const hostName = Object.fromEntries(linked.map((l) => [l.org_id, l.name]));
  let shared: (NonNullable<typeof own>[number] & { org_id: string })[] = [];
  if (linked.length) {
    let sq = supabase.from("events").select("id, title, start_at, end_at, location, cost_cents, kind, canceled, cap, org_id")
      .in("org_id", linked.map((l) => l.org_id)).eq("share_linked", true);
    sq = past ? sq.lt("start_at", now).limit(50) : sq.gte("start_at", now).limit(100);
    shared = ((await sq).data ?? []) as typeof shared;
  }
  const events = [...(own ?? []).map((e) => ({ ...e, org_id: current.org.id })), ...shared]
    .sort((a, b) => past ? b.start_at.localeCompare(a.start_at) : a.start_at.localeCompare(b.start_at));

  const ids = (own ?? []).map((e) => e.id);
  const { data: going } = ids.length
    ? await supabase.from("rsvps").select("event_id").in("event_id", ids).eq("status", "going")
    : { data: [] as { event_id: string }[] };
  const goingCount = (id: string) => (going ?? []).filter((r) => r.event_id === id).length;

  const byMonth = new Map<string, typeof events>();
  for (const e of events) {
    const k = fmtDate(e.start_at, { month: "long", year: "numeric" });
    byMonth.set(k, [...(byMonth.get(k) ?? []), e]);
  }

  return (
    <Shell ctx={ctx}>
      <PageTitle title="Events" sub={past ? "Past events" : "What's coming up"}
        action={isLeader ? <LinkButton href="/events/new">+ New event</LinkButton> : undefined} />

      <div className="flex items-end gap-6 border-b-2 border-[#DDD6C5]">
        {[["/events", "Upcoming", !past], ["/events?past=1", "Past", past]].map(([href, label, on]) => (
          <Link key={String(href)} href={String(href)} className="min-h-[44px] -mb-[2px] px-0.5 flex items-center border-b-[3px] no-underline text-[15px]"
            style={{ borderColor: on ? "#F5B700" : "transparent", color: on ? "#101B2D" : "#4B5568", fontWeight: on ? 700 : 500 }}>{String(label)}</Link>
        ))}
        <a href={`webcal://${process.env.NEXT_PUBLIC_SITE_HOST ?? "localhost:3000"}/api/calendar/${current.org.id}?t=${calToken ?? ""}`}
          className="ml-auto min-h-[44px] flex items-center text-[14px] font-bold text-forest no-underline">Add to my calendar</a>
      </div>

      {!events.length && <Empty>{past ? "No past events yet." : isLeader ? "No events yet. Tap + New event to post your first one." : "Nothing on the calendar yet."}</Empty>}

      {[...byMonth.entries()].map(([month, list]) => (
        <section key={month} className="flex flex-col gap-2">
          <h2 className="font-bold text-[13px] tracking-widest uppercase m-0 text-smoke">{month}</h2>
          <div className="card p-0 overflow-hidden">
            {list.map((e) => {
              const multi = e.end_at && new Date(e.end_at).toDateString() !== new Date(e.start_at).toDateString();
              const host = e.org_id !== current.org.id ? hostName[e.org_id] : null;
              return (
                <Link key={e.id} href={`/events/${e.id}`} className="flex items-center gap-4 px-5 py-3.5 no-underline text-ink border-b border-[#EAE4D6] last:border-0"
                  style={{ opacity: e.canceled ? 0.55 : 1 }}>
                  <div className="w-12 text-center flex-none">
                    <div className="text-[11px] font-bold uppercase text-smoke">{fmtDate(e.start_at, { weekday: "short" })}</div>
                    <div className="font-display font-extrabold text-[24px] leading-none text-forest">{dayOfMonth(e.start_at)}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[16px] truncate">{e.title}{e.canceled ? " (canceled)" : ""}</div>
                    <div className="text-[13px] text-smoke truncate">
                      {multi ? `${fmtDate(e.start_at)} – ${fmtDate(e.end_at!)}` : fmtTime(e.start_at)}
                      {e.location ? ` · ${e.location}` : ""} · {KIND_LABEL[e.kind] ?? "Event"}
                      {host ? ` · hosted by ${host}` : ""}
                    </div>
                  </div>
                  {e.cost_cents > 0 && <span className="text-[14px] font-bold hidden sm:block">{money(e.cost_cents)}</span>}
                  {host
                    ? <span className="text-[13px] font-bold px-3 py-1 rounded-full flex-none" style={{ background: "#FFF6D6", color: "#5E4400" }}>Linked unit</span>
                    : <span className="text-[13px] font-bold px-3 py-1 rounded-full flex-none" style={{ background: "#EEE8D9", color: "#12355F" }}>{goingCount(e.id)}{e.cap ? `/${e.cap}` : ""} going</span>}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </Shell>
  );
}

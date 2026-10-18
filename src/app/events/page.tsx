import Link from "next/link";
import { requireOrg } from "@/lib/context";
import Shell from "@/components/Shell";
import { Chip, Empty, LinkButton, PageTitle, fmtDate, fmtTime, money } from "@/components/ui";

const KIND_LABEL: Record<string, string> = {
  meeting: "Meeting", campout: "Campout", service: "Service", fundraiser: "Fundraiser", event: "Event", high_adventure: "High adventure",
};

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ past?: string }> }) {
  const { past } = await searchParams;
  const ctx = await requireOrg();
  const { supabase, current, isLeader } = ctx;
  const now = new Date().toISOString();

  let q = supabase.from("events").select("id, title, start_at, end_at, location, cost_cents, kind, canceled, cap")
    .eq("org_id", current.org.id);
  q = past ? q.lt("start_at", now).order("start_at", { ascending: false }).limit(50) : q.gte("start_at", now).order("start_at").limit(100);
  const { data: events } = await q;

  const ids = (events ?? []).map((e) => e.id);
  const { data: going } = ids.length
    ? await supabase.from("rsvps").select("event_id").in("event_id", ids).eq("status", "going")
    : { data: [] as { event_id: string }[] };
  const goingCount = (id: string) => (going ?? []).filter((r) => r.event_id === id).length;

  const byMonth = new Map<string, NonNullable<typeof events>>();
  for (const e of events ?? []) {
    const k = fmtDate(e.start_at, { month: "long", year: "numeric" });
    byMonth.set(k, [...(byMonth.get(k) ?? []), e]);
  }

  return (
    <Shell ctx={ctx}>
      <PageTitle title="Events" sub={past ? "Past events" : "What's coming up"}
        action={isLeader ? <LinkButton href="/events/new">+ New event</LinkButton> : undefined} />

      <div className="flex gap-2">
        <Link href="/events" className="px-3 py-1.5 rounded-full text-[13px] font-bold no-underline border"
          style={{ background: !past ? "#1F5F4A" : "white", color: !past ? "white" : "#4D5F57", borderColor: !past ? "#1F5F4A" : "#D5DFDA" }}>Upcoming</Link>
        <Link href="/events?past=1" className="px-3 py-1.5 rounded-full text-[13px] font-bold no-underline border"
          style={{ background: past ? "#1F5F4A" : "white", color: past ? "white" : "#4D5F57", borderColor: past ? "#1F5F4A" : "#D5DFDA" }}>Past</Link>
        <a href={`/api/calendar/${current.org.id}`} className="ml-auto px-3 py-1.5 rounded-full text-[13px] font-bold no-underline border border-border bg-white text-smoke">
          Add to my calendar
        </a>
      </div>

      {!events?.length && <Empty>{past ? "No past events yet." : isLeader ? "No events yet. Tap + New event to post your first one." : "Nothing on the calendar yet."}</Empty>}

      {[...byMonth.entries()].map(([month, list]) => (
        <section key={month} className="flex flex-col gap-2">
          <h2 className="font-bold text-[13px] tracking-widest uppercase m-0 text-smoke">{month}</h2>
          {list.map((e) => {
            const multi = e.end_at && new Date(e.end_at).toDateString() !== new Date(e.start_at).toDateString();
            return (
              <Link key={e.id} href={`/events/${e.id}`} className="card flex items-center gap-3 no-underline text-ink"
                style={{ opacity: e.canceled ? 0.55 : 1 }}>
                <div className="w-12 text-center flex-none">
                  <div className="text-[11px] font-bold uppercase text-smoke">{fmtDate(e.start_at, { weekday: "short" })}</div>
                  <div className="font-display font-extrabold text-[24px] leading-none">{new Date(e.start_at).getDate()}</div>
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <div className="font-bold text-[16px] truncate">{e.title}</div>
                  <div className="text-[13px] text-smoke truncate">
                    {multi ? `${fmtDate(e.start_at)} – ${fmtDate(e.end_at!)}` : fmtTime(e.start_at)}{e.location ? ` · ${e.location}` : ""}
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {multi && <Chip tone="orange">{Math.round((new Date(e.end_at!).getTime() - new Date(e.start_at).getTime()) / 86400000)} nights</Chip>}
                    <Chip>{KIND_LABEL[e.kind] ?? "Event"}</Chip>
                    {e.cost_cents > 0 && <Chip>{money(e.cost_cents)}</Chip>}
                    <Chip tone="green">{goingCount(e.id)}{e.cap ? ` / ${e.cap}` : ""} going</Chip>
                    {e.canceled && <Chip tone="red">Canceled</Chip>}
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      ))}
    </Shell>
  );
}

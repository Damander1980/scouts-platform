import Link from "next/link";
import { TIME_ZONE } from "@/components/ui";

type Ev = { id: string; title: string; start_at: string; end_at: string | null; kind: string; canceled: boolean; org_id: string };

// Calendar date (YYYY-MM-DD) of an instant in the unit's time zone.
const ymd = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TIME_ZONE });

// Month grid for leaders at a computer. Multi-day trips show on every day they cover.
export default function MonthGrid({ month, events, ownOrg }: { month: string; events: Ev[]; ownOrg: string }) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = first.getUTCDay();
  const cells = Array.from({ length: Math.ceil((lead + daysIn) / 7) * 7 }, (_, i) => i - lead + 1);
  const key = (d: number) => `${month}-${String(d).padStart(2, "0")}`;
  const today = ymd(new Date().toISOString());
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  const label = first.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  const onDay = (d: number) => events.filter((e) => {
    const s = ymd(e.start_at), en = e.end_at ? ymd(e.end_at) : s;
    return key(d) >= s && key(d) <= en;
  });

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[#EAE4D6]">
        <Link href={`/events?view=month&month=${prev}`} aria-label="Previous month" className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full no-underline text-ink font-bold text-[18px]">‹</Link>
        <span className="font-display font-extrabold text-[20px] flex-1 text-center">{label}</span>
        <Link href={`/events?view=month&month=${next}`} aria-label="Next month" className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full no-underline text-ink font-bold text-[18px]">›</Link>
      </div>
      <div className="hidden md:block overflow-x-auto">
        <div className="grid grid-cols-7 min-w-[700px]">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="px-2 py-2 eyebrow text-smoke" style={{ background: "#F8F5EE" }}>{d}</div>
          ))}
          {cells.map((d, i) => {
            const inMonth = d >= 1 && d <= daysIn;
            const isToday = inMonth && key(d) === today;
            return (
              <div key={i} className="min-h-[104px] p-1.5 border-t border-l border-[#EAE4D6] flex flex-col gap-1" style={{ background: inMonth ? "#FFFFFF" : "#FBF9F4" }}>
                {inMonth && (
                  <span className="text-[13px] font-bold w-7 h-7 flex items-center justify-center rounded-full"
                    style={isToday ? { background: "#12355F", color: "#FFFFFF" } : { color: "#4B5568" }}>{d}</span>
                )}
                {inMonth && onDay(d).map((e) => (
                  <Link key={e.id} href={`/events/${e.id}`}
                    className="text-[12px] font-bold leading-tight px-2 py-1 rounded-md no-underline truncate"
                    style={{
                      background: e.org_id !== ownOrg ? "#FFF6D6" : e.kind === "meeting" ? "#EEE8D9" : "#12355F",
                      color: e.org_id !== ownOrg ? "#5E4400" : e.kind === "meeting" ? "#12355F" : "#FFFFFF",
                      textDecoration: e.canceled ? "line-through" : undefined,
                    }}>
                    {e.title}
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Phones: a 7-day grid that fits (a dot marks days with something on), then the month as a list. */}
      <div className="md:hidden" data-view="phone">
        <div className="grid grid-cols-7 px-2 pt-2">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="eyebrow text-smoke text-center py-1">{d}</div>)}
          {cells.map((d, i) => {
            const inMonth = d >= 1 && d <= daysIn;
            const evs = inMonth ? onDay(d) : [];
            return (
              <div key={i} className="h-11 flex flex-col items-center justify-center gap-0.5">
                {inMonth && (
                  <span className="text-[14px] font-bold w-7 h-7 flex items-center justify-center rounded-full"
                    style={key(d) === today ? { background: "#12355F", color: "#FFFFFF" } : { color: evs.length ? "#101B2D" : "#AEB9C9" }}>{d}</span>
                )}
                {evs.length > 0 && <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full" style={{ background: evs.some((e) => e.org_id !== ownOrg) ? "#F5B700" : "#12355F" }} />}
              </div>
            );
          })}
        </div>
        <ul className="m-0 p-0 list-none border-t border-[#EAE4D6]">
          {events.filter((e) => ymd(e.start_at).startsWith(month) || (e.end_at && ymd(e.end_at).startsWith(month))).length === 0 && (
            <li className="px-5 py-6 text-center text-smoke text-[15px]">Nothing on the calendar this month.</li>
          )}
          {events.filter((e) => ymd(e.start_at).startsWith(month) || (e.end_at && ymd(e.end_at).startsWith(month)))
            .sort((a, b) => a.start_at.localeCompare(b.start_at)).map((e) => (
            <li key={e.id} className="border-b border-[#EAE4D6] last:border-0">
              <Link href={`/events/${e.id}`} className="flex items-center gap-3 px-4 min-h-[56px] no-underline text-ink">
                <span className="w-11 flex-none text-center leading-tight">
                  <span className="block eyebrow text-smoke">{new Date(e.start_at).toLocaleDateString("en-US", { weekday: "short", timeZone: TIME_ZONE })}</span>
                  <span className="block font-display font-extrabold text-[20px]">{Number(ymd(e.start_at).slice(8))}</span>
                </span>
                <span aria-hidden="true" className="w-1 self-stretch my-2 rounded-full" style={{ background: e.org_id !== ownOrg ? "#F5B700" : e.kind === "meeting" ? "#AEB9C9" : "#12355F" }} />
                <span className="flex-1 min-w-0 font-bold text-[15px] truncate" style={{ textDecoration: e.canceled ? "line-through" : undefined }}>{e.title}</span>
                <span className="text-[13px] text-smoke flex-none">{new Date(e.start_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TIME_ZONE })}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

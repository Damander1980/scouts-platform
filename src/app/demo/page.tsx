import Link from "next/link";
import AppShell from "@/components/AppShell";
import { Chip, fmtDate, fmtTime, money } from "@/components/ui";

// Sample parent home with made-up data, laid out like the real /dashboard. Nothing here saves.
const day = (d: number, h = 19) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, 0, 0, 0); return x.toISOString(); };
const EVENTS = [
  { id: "1", title: "Troop meeting", start_at: day(1), answered: true },
  { id: "2", title: "Caprock Canyons campout", start_at: day(9, 17), answered: false },
  { id: "3", title: "Food bank service project", start_at: day(16, 9), answered: true },
  { id: "4", title: "Court of Honor", start_at: day(30), answered: false },
];
const FLOAT = { boxShadow: "0 2px 4px rgba(16,27,45,.08), 0 14px 32px rgba(16,27,45,.18)" };

export default function DemoParentHome() {
  return (
    <AppShell orgName="Troop 999" orgs={[{ id: "demo", label: "Troop 999" }]} currentOrgId="demo" initials="TG" isLeader={false}>
      <div className="rounded-[14px] px-4 py-3 text-[14px] font-bold flex items-center gap-3 flex-wrap" style={{ background: "#FFF6D6", color: "#5E4400" }}>
        <span className="flex-1">Sample screen with made-up families. Nothing here saves.</span>
        <Link href="/demo/tour" className="text-forest">Back to the tour</Link>
      </div>

      <div>
        <h1 className="font-display font-extrabold text-[32px] leading-tight m-0">Good evening, Tom</h1>
        <p className="text-[16px] text-smoke m-0 mt-1">3 things need you.</p>
      </div>

      <div className="rounded-[20px] p-6 md:p-7 flex flex-wrap items-center gap-5 text-white" style={{ background: "#12355F", ...FLOAT }}>
        <div className="flex-1 min-w-[260px] flex flex-col gap-1.5">
          <span className="text-[12px] font-bold uppercase tracking-widest" style={{ color: "#F5B700" }}>
            Next up · {fmtDate(EVENTS[1].start_at, { weekday: "short", month: "short", day: "numeric" })} · {fmtTime(EVENTS[1].start_at)}
          </span>
          <span className="font-display font-extrabold text-[28px] leading-tight">Caprock Canyons campout</span>
          <span className="text-[15px]" style={{ color: "#D7E0EE" }}>Caprock Canyons State Park · $45.00 per person · reply by {fmtDate(day(6))}</span>
          <div className="flex gap-2 flex-wrap mt-1">
            <span className="text-[13px] font-bold px-3 py-1 rounded-full" style={{ background: "#F5B700", color: "#101B2D" }}>Jake: Going</span>
            <span className="text-[13px] font-bold px-3 py-1 rounded-full" style={{ background: "rgba(255,255,255,.14)" }}>Maya: No reply</span>
          </div>
        </div>
        <span className="min-h-[52px] px-7 rounded-full font-bold text-[16px] flex items-center" style={{ background: "#F5B700", color: "#101B2D" }}>Sign up and pay</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="card flex flex-col gap-1.5">
          <span className="text-[12px] font-bold uppercase tracking-widest text-forest">You owe</span>
          <span className="font-display font-extrabold text-[34px] leading-tight" style={{ color: "#5E4400" }}>{money(4500)}</span>
          <span className="text-[14px] text-smoke">Jake&apos;s spot at Caprock. Card, cash or check.</span>
          <span className="font-bold text-forest min-h-[44px] flex items-center">Pay now</span>
        </div>
        <div className="card flex flex-col gap-1.5">
          <span className="text-[12px] font-bold uppercase tracking-widest text-forest">Forms</span>
          <span className="font-display font-extrabold text-[34px] leading-tight">1 needed</span>
          <span className="text-[14px] text-smoke">Maya: health form Parts A and B needed</span>
          <span className="font-bold text-forest min-h-[44px] flex items-center">Get the blank form</span>
        </div>
        <div className="card flex flex-col gap-1.5">
          <span className="text-[12px] font-bold uppercase tracking-widest text-forest">Ways to help</span>
          <span className="font-display font-extrabold text-[34px] leading-tight">Pitch in</span>
          <span className="text-[14px] text-smoke">Drivers needed for Caprock. Popcorn booth Saturday.</span>
          <span className="font-bold text-forest min-h-[44px] flex items-center">See how to help</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-5">
        <section className="card flex-[1_1_420px] min-w-0 flex flex-col">
          <span className="text-[12px] font-bold uppercase tracking-widest text-forest mb-2">Calendar</span>
          {EVENTS.map((e) => (
            <div key={e.id} className="flex items-center gap-4 min-h-[56px] border-t border-[#EAE4D6]">
              <span className="w-16 font-bold text-forest text-[14px]">{fmtDate(e.start_at, { month: "short", day: "numeric" })}</span>
              <span className="flex-1 font-bold text-[15px] truncate">{e.title}</span>
              {e.answered ? <span className="text-[14px] text-smoke">{fmtTime(e.start_at)}</span> : <Chip tone="orange">Not answered</Chip>}
            </div>
          ))}
        </section>
        <section className="card flex-[1_1_300px] min-w-0 flex flex-col gap-3">
          <span className="text-[12px] font-bold uppercase tracking-widest text-forest">My Scouts</span>
          {[["JG", "Jake"], ["MG", "Maya"]].map(([i, n]) => (
            <Link key={n} href="/demo/advancement" className="flex items-center gap-3 no-underline text-ink min-h-[52px]">
              <span className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-[14px] flex-none" style={{ background: "#D7E0EE", color: "#12355F" }}>{i}</span>
              <span className="flex-1 font-bold text-[15px]">{n}</span>
              <span className="text-[14px] font-bold text-forest">Ranks and badges</span>
            </Link>
          ))}
        </section>
      </div>
    </AppShell>
  );
}

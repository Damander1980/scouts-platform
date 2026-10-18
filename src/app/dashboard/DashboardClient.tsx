"use client";

import Link from "next/link";

const ROLE_LABELS: Record<string, string> = {
  scoutmaster: "Scoutmaster",
  assistant_scoutmaster: "Asst. Scoutmaster",
  committee_chair: "Committee Chair",
  committee_member: "Committee Member",
  treasurer: "Treasurer",
  advancement_chair: "Advancement Chair",
  chartered_org_rep: "Chartered Org Rep",
  parent_guardian: "Parent / Guardian",
  scout: "Scout",
  den_leader: "Den Leader",
  cubmaster: "Cubmaster",
  crew_advisor: "Crew Advisor",
  skipper: "Skipper",
};

const LEADER_ROLES = new Set([
  "scoutmaster","assistant_scoutmaster","committee_chair","committee_member",
  "treasurer","advancement_chair","chartered_org_rep","den_leader","cubmaster",
  "crew_advisor","skipper",
]);

function formatEventDate(iso: string) {
  const d = new Date(iso);
  return {
    mon: d.toLocaleString("en-US", { month: "short" }).toUpperCase(),
    day: String(d.getDate()),
    dow: d.toLocaleString("en-US", { weekday: "short" }),
    time: d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
    full: d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
  };
}

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

type Event = {
  id: string; title: string; start_at: string; end_at: string | null;
  location: string | null; cost_cents: number; rsvpStatus: string | null;
};

type ActionItem = { id: string; title: string; amount: number; due: string };

export default function DashboardClient({
  person, org, role, events, actionItems, balanceCents,
}: {
  person: { id: string; first_name: string; last_name: string; type: string };
  org: { id: string; name: string; type: string; unit_number: string; city: string; join_code: string };
  role: string;
  events: Event[];
  actionItems: ActionItem[];
  balanceCents: number;
}) {
  const isLeader = LEADER_ROLES.has(role);
  const unitWord = org.type === "cubs" ? "Pack" : org.type === "venturing" ? "Crew" : org.type === "sea" ? "Ship" : "Troop";

  return (
    <div className="min-h-screen bg-paper flex flex-col" style={{ fontFamily: "'DM Sans', sans-serif", color: "#14211B" }}>

      {/* ── Header ── */}
      <header className="bg-forest text-white px-4 pt-5 pb-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white text-forest flex items-center justify-center font-display font-extrabold text-sm flex-none">
              {org.unit_number || org.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-[16px] leading-tight">{unitWord} {org.unit_number}</span>
              <span className="text-[13px]" style={{ color: "#9DB0A7" }}>{org.city} · {ROLE_LABELS[role] ?? role}</span>
            </div>
          </div>
          <Link href="/profile"
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm no-underline">
            {person.first_name[0]}{person.last_name[0]}
          </Link>
        </div>

        <div>
          <h1 className="font-display font-extrabold text-[26px] leading-tight m-0">
            Hey, {person.first_name}.
          </h1>
          <p className="text-[14px] m-0" style={{ color: "#9DB0A7" }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 px-4 py-4 flex flex-col gap-5 max-w-lg mx-auto w-full">

        {/* Action items */}
        {actionItems.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="font-bold text-[13px] tracking-widest uppercase text-smoke m-0">Needs you</h2>
            <div className="flex flex-col gap-2">
              {actionItems.map((item) => (
                <div key={item.id}
                  className="rounded-2xl p-4 flex items-center justify-between gap-3"
                  style={{ background: "#FFF1E6", border: "1px solid #FFD6B8" }}>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-[15px]">{item.title}</span>
                    <span className="text-[13px] text-smoke">
                      {dollars(item.amount)} · due {new Date(item.due).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <Link href={`/pay/${item.id}`}
                    className="min-h-[40px] px-4 rounded-full font-bold text-[14px] flex items-center no-underline flex-none"
                    style={{ background: "#FF6A1A", color: "#14211B" }}>
                    Pay
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Balance (only if non-zero) */}
        {balanceCents !== 0 && (
          <div className="rounded-2xl p-4 flex items-center justify-between"
            style={{ background: balanceCents > 0 ? "#FFF1E6" : "#EAF0ED", border: "1px solid #D5DFDA" }}>
            <div className="flex flex-col gap-0.5">
              <span className="text-[12px] font-bold tracking-widest uppercase text-smoke">Account balance</span>
              <span className="font-display font-bold text-[22px]"
                style={{ color: balanceCents > 0 ? "#7A2E00" : "#1F5F4A" }}>
                {balanceCents > 0 ? `${dollars(balanceCents)} owed` : `${dollars(Math.abs(balanceCents))} credit`}
              </span>
            </div>
            {balanceCents > 0 && (
              <Link href="/pay" className="min-h-[40px] px-4 rounded-full font-bold text-[14px] flex items-center no-underline"
                style={{ background: "#FF6A1A", color: "#14211B" }}>
                Pay now
              </Link>
            )}
          </div>
        )}

        {/* Upcoming events */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-[13px] tracking-widest uppercase text-smoke m-0">Coming up</h2>
            {isLeader && (
              <Link href="/events/new" className="text-forest font-bold text-[13px] no-underline">
                + Add event
              </Link>
            )}
          </div>

          {events.length === 0 && (
            <div className="rounded-2xl p-5 text-center text-smoke text-[15px] bg-white border border-border">
              No upcoming events.{isLeader ? " Tap + Add event to create one." : ""}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {events.map((ev) => {
              const d = formatEventDate(ev.start_at);
              const going = ev.rsvpStatus === "going";
              const notGoing = ev.rsvpStatus === "not_going";

              return (
                <Link key={ev.id} href={`/events/${ev.id}`}
                  className="bg-white border border-border rounded-2xl p-4 flex gap-3 items-start no-underline"
                  style={{ color: "#14211B" }}>
                  {/* Date column */}
                  <div className="flex flex-col items-center w-11 flex-none pt-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-smoke">{d.mon}</span>
                    <span className="font-display font-extrabold text-[26px] leading-none">{d.day}</span>
                    <span className="text-[10px] text-smoke">{d.dow}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 flex flex-col gap-1">
                    <span className="font-bold text-[16px] leading-snug">{ev.title}</span>
                    <span className="text-[13px] text-smoke">
                      {d.time}{ev.location ? ` · ${ev.location}` : ""}
                    </span>
                    <div className="flex flex-wrap gap-1.5 mt-0.5">
                      {ev.cost_cents > 0 && (
                        <span className="inline-flex items-center h-5 px-2 rounded-full text-[11px] font-bold"
                          style={{ background: "#EAF0ED", color: "#1F5F4A" }}>
                          {dollars(ev.cost_cents)}
                        </span>
                      )}
                      {going && (
                        <span className="inline-flex items-center h-5 px-2 rounded-full text-[11px] font-bold gap-1"
                          style={{ background: "#EAF0ED", color: "#1F5F4A" }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                          Going
                        </span>
                      )}
                      {notGoing && (
                        <span className="inline-flex items-center h-5 px-2 rounded-full text-[11px] font-bold"
                          style={{ background: "#F4F6F5", color: "#4D5F57" }}>
                          Not going
                        </span>
                      )}
                      {!ev.rsvpStatus && (
                        <span className="inline-flex items-center h-5 px-2 rounded-full text-[11px] font-bold"
                          style={{ background: "#FFF1E6", color: "#7A2E00" }}>
                          RSVP needed
                        </span>
                      )}
                    </div>
                  </div>

                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9DB0A7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-none mt-1" aria-hidden="true">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Leader quick actions */}
        {isLeader && (
          <section className="flex flex-col gap-2">
            <h2 className="font-bold text-[13px] tracking-widest uppercase text-smoke m-0">Quick actions</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: "/roster", label: "Roster", icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" },
                { href: "/events/new", label: "New event", icon: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" },
                { href: "/messages/new", label: "Message troop", icon: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" },
                { href: `/join/${org.join_code}`, label: "Join link", icon: "M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" },
              ].map((a) => (
                <Link key={a.href} href={a.href}
                  className="bg-white border border-border rounded-2xl p-4 flex flex-col gap-2 no-underline"
                  style={{ color: "#14211B" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1F5F4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d={a.icon}/>
                  </svg>
                  <span className="font-bold text-[15px]">{a.label}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Troop join code (leaders only) */}
        {isLeader && (
          <div className="rounded-2xl p-4 flex items-center justify-between gap-3 bg-white border border-border">
            <div className="flex flex-col gap-0.5">
              <span className="text-[12px] font-bold tracking-widest uppercase text-smoke">Family join code</span>
              <span className="font-display font-bold text-[24px] tracking-widest">{org.join_code.toUpperCase()}</span>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(`Join ${unitWord} ${org.unit_number} on ScoutPlatform: scoutplatform.app/join/${org.join_code}`)}
              className="min-h-[40px] px-4 rounded-full font-bold text-[14px] border border-border bg-paper"
              style={{ fontFamily: "inherit", color: "#14211B" }}>
              Copy link
            </button>
          </div>
        )}
      </div>

      {/* ── Bottom nav ── */}
      <nav className="bg-white border-t border-border px-2 pb-5 pt-2 flex justify-around sticky bottom-0">
        {[
          { href: "/dashboard", label: "Home", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
          { href: "/events", label: "Events", icon: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" },
          ...(isLeader ? [{ href: "/roster", label: "Roster", icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" }] : []),
          { href: "/family", label: "Family", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" },
        ].map((n) => (
          <Link key={n.href} href={n.href}
            className="flex flex-col items-center gap-1 min-h-[44px] min-w-[44px] justify-center no-underline px-3"
            style={{ color: "#4D5F57" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={n.icon}/>
            </svg>
            <span className="text-[11px] font-bold">{n.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

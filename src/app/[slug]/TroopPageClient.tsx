"use client";

import { useState } from "react";

const ROLE_LABELS: Record<string, string> = {
  scoutmaster: "Scoutmaster",
  assistant_scoutmaster: "Assistant Scoutmaster",
  committee_chair: "Committee Chair",
  cubmaster: "Cubmaster",
  crew_advisor: "Crew Advisor",
  skipper: "Skipper",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return {
    mon: d.toLocaleString("en-US", { month: "short" }).toUpperCase(),
    day: String(d.getDate()),
    dow: d.toLocaleString("en-US", { weekday: "short" }),
    time: d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
  };
}

function isMultiDay(start: string, end: string | null) {
  if (!end) return false;
  const e = new Date(end);
  const s = new Date(start);
  return e.getTime() - s.getTime() > 20 * 60 * 60 * 1000;
}

function multiDayLabel(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const days = Math.round((e.getTime() - s.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const endDow = e.toLocaleString("en-US", { weekday: "short" });
  return `${endDow} · ${days} days`;
}

export default function TroopPageClient({
  org, events, leaders,
}: {
  org: {
    id: string; name: string; type: string; unit_number: string;
    city: string; state?: string; slug: string; settings: Record<string, unknown>;
  };
  events: { id: string; title: string; start_at: string; end_at: string | null; location: string | null; cost_cents: number }[];
  leaders: { role: string; name: string }[];
}) {
  const [parentName, setParentName] = useState("");
  const [email, setEmail] = useState("");
  const [grade, setGrade] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const unitWord = org.type === "cubs" ? "Pack"
    : org.type === "venturing" ? "Crew"
    : org.type === "sea" ? "Ship"
    : "Troop";

  const displayName = org.unit_number ? `${unitWord} ${org.unit_number}` : org.name;
  const tagline = (org.settings as { tagline?: string }).tagline
    ?? `A ${org.type === "cubs" ? "Cub Scouts" : org.type === "venturing" ? "Venturing" : org.type === "sea" ? "Sea Scouts" : "Scouts BSA"} unit based in ${org.city}. Come find out what Scouting is about.`;

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    await new Promise((r) => setTimeout(r, 800));
    setSent(true);
    setSending(false);
  }

  return (
    <div className="min-h-screen bg-paper" style={{ color: "#14211B", fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Nav ── */}
      <header className="bg-forest text-white sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Fleur-de-lis badge */}
            <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center flex-none" style={{ color: "#1F5F4A" }}>
              <svg width="26" height="26" viewBox="0 0 36 36" fill="none" aria-hidden="true">
                <path d="M18 3C18 3 14 9 14 14C14 17 16 18 18 18C20 18 22 17 22 14C22 9 18 3 18 3Z" fill="#1F5F4A"/>
                <path d="M18 18C18 18 10 15 7 19C5 22 7 25 10 24C12 23 13 21 14 19" fill="#1F5F4A" opacity=".7"/>
                <path d="M18 18C18 18 26 15 29 19C31 22 29 25 26 24C24 23 23 21 22 19" fill="#1F5F4A" opacity=".7"/>
                <circle cx="18" cy="20" r="2" fill="#1F5F4A" opacity=".5"/>
              </svg>
            </div>
            <div>
              <div className="font-bold text-[17px] leading-tight">{displayName}</div>
              <div className="text-sm" style={{ color: "#CFE3DA" }}>{org.city}{org.state ? `, ${org.state}` : ""}</div>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-1">
            {[["#about","About"],["#calendar","Calendar"],["#leaders","Leaders"]].map(([href, label]) => (
              <a key={href} href={href}
                className="text-white font-bold text-[15px] no-underline hover:underline min-h-[44px] flex items-center px-2">
                {label}
              </a>
            ))}
            <a href="#join"
              className="ml-2 min-h-[44px] px-5 rounded-full font-bold text-[15px] flex items-center no-underline"
              style={{ background: "#FF6A1A", color: "#14211B" }}>
              Join us
            </a>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <div className="bg-forest text-white">
        <div className="max-w-5xl mx-auto px-5 py-12 flex flex-wrap gap-8 items-stretch">
          <div className="flex flex-col gap-5 justify-center" style={{ flex: "1 1 400px" }}>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[13px] tracking-widest uppercase" style={{ color: "#9DB0A7" }}>
                {org.city}{org.state ? `, ${org.state}` : ""}
              </span>
            </div>
            <h1 className="font-display font-extrabold leading-none m-0" style={{ fontSize: "clamp(44px, 6vw, 64px)" }}>
              {displayName}
            </h1>
            <p className="text-[18px] leading-relaxed m-0" style={{ color: "#CFE3DA", maxWidth: 480 }}>
              {tagline}
            </p>

            {events[0] && (
              <div className="rounded-2xl p-4 flex flex-col gap-1"
                style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)" }}>
                <span className="text-[12px] font-bold tracking-widest uppercase" style={{ color: "#9DB0A7" }}>
                  Next event
                </span>
                <span className="font-display font-bold text-[22px]">{events[0].title}</span>
                <span className="text-[15px]" style={{ color: "#CFE3DA" }}>
                  {new Date(events[0].start_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  {" · "}{formatDate(events[0].start_at).time}
                  {events[0].location ? ` · ${events[0].location}` : ""}
                </span>
              </div>
            )}

            <div className="flex gap-3 pt-1 flex-wrap">
              <a href="#join"
                className="min-h-[48px] px-6 rounded-full font-bold text-[16px] flex items-center no-underline"
                style={{ background: "#FF6A1A", color: "#14211B" }}>
                Request to join
              </a>
              <a href="#calendar"
                className="min-h-[48px] px-6 rounded-full font-bold text-[16px] flex items-center no-underline"
                style={{ border: "2px solid rgba(255,255,255,0.35)", color: "#FFFFFF" }}>
                See events
              </a>
            </div>
          </div>

          {/* Photo slot */}
          <div className="rounded-3xl flex items-center justify-center text-center p-6"
            style={{ flex: "1 1 320px", border: "2px dashed rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.07)", minHeight: 280 }}>
            {(org.settings as { hero_photo?: string }).hero_photo
              ? <img src={(org.settings as { hero_photo?: string }).hero_photo} alt={displayName}
                  className="w-full h-full object-cover rounded-2xl" />
              : <span style={{ color: "#9DB0A7", fontSize: 15 }}>Add your best troop photo in leader settings</span>}
          </div>
        </div>
      </div>

      {/* ── About ── */}
      <section id="about" className="max-w-5xl mx-auto px-5 py-14 flex flex-col gap-4">
        <h2 className="font-display font-extrabold text-[34px] m-0">About the troop</h2>
        <p className="text-[18px] leading-relaxed max-w-2xl m-0 text-smoke">
          {(org.settings as { about?: string }).about
            ?? "Leaders can add their troop story in their settings — when the troop started, who sponsors it, what a typical month looks like, and what costs to expect."}
        </p>
      </section>

      {/* ── Calendar ── */}
      <div id="calendar" style={{ background: "#EAF0ED" }}>
        <div className="max-w-5xl mx-auto px-5 py-14 flex flex-col gap-5">
          <h2 className="font-display font-extrabold text-[34px] m-0">Coming up</h2>
          <div className="bg-white border border-border rounded-2xl overflow-hidden max-w-2xl">
            {events.length === 0 && (
              <div className="p-5 text-smoke text-base">No upcoming events yet.</div>
            )}
            {events.map((ev, i) => {
              const d = formatDate(ev.start_at);
              const multi = isMultiDay(ev.start_at, ev.end_at);
              return (
                <div key={ev.id}
                  className="flex gap-4 p-4 items-start"
                  style={{ borderBottom: i < events.length - 1 ? "1px solid #E6ECE9" : "none" }}>
                  <div className="flex flex-col items-center w-12 flex-none">
                    <span className="text-[11px] font-bold text-smoke uppercase tracking-wide">{d.mon}</span>
                    <span className="font-display font-extrabold text-[30px] leading-none">{d.day}</span>
                    <span className="text-[11px] text-smoke">{d.dow}</span>
                  </div>
                  <div className="flex flex-col gap-1 flex-1 pt-1">
                    <span className="font-bold text-[18px]">{ev.title}</span>
                    <span className="text-smoke text-[15px]">
                      {d.time}{ev.location ? ` · ${ev.location}` : ""}
                    </span>
                    {multi && ev.end_at && (
                      <span className="inline-flex items-center h-6 rounded-full text-ink text-[13px] font-bold px-3 self-start"
                        style={{ background: "#FF6A1A" }}>
                        {multiDayLabel(ev.start_at, ev.end_at)}
                      </span>
                    )}
                    {ev.cost_cents > 0 && (
                      <span className="inline-flex items-center h-6 rounded-full text-[13px] font-bold px-3 self-start"
                        style={{ background: "#EAF0ED", color: "#1F5F4A" }}>
                        ${(ev.cost_cents / 100).toFixed(0)} per person
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Leaders ── */}
      <section id="leaders" className="max-w-5xl mx-auto px-5 py-14 flex flex-col gap-5">
        <h2 className="font-display font-extrabold text-[34px] m-0">Leaders</h2>
        {leaders.length === 0 && <p className="text-smoke">Leader list coming soon.</p>}
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
          {leaders.map((l, i) => (
            <div key={i} className="bg-white border border-border rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-forest text-white flex items-center justify-center font-display font-bold text-[16px] flex-none">
                {l.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-[17px]">{l.name}</span>
                <span className="text-smoke text-[14px]">{ROLE_LABELS[l.role] ?? l.role}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-sm text-smoke m-0">
          Contact leaders through the form below. Personal emails are never shown.
        </p>
      </section>

      {/* ── Join CTA ── */}
      <section id="join" className="max-w-5xl mx-auto px-5 pb-16">
        <div className="rounded-3xl p-8 flex flex-wrap gap-8" style={{ background: "#14211B", color: "#FFFFFF" }}>
          <div className="flex flex-col gap-4 justify-center" style={{ flex: "1 1 260px" }}>
            <svg width="44" height="44" viewBox="0 0 36 36" fill="none" aria-hidden="true">
              <path d="M18 2C18 2 14 8 14 13C14 16 16 17 18 17C20 17 22 16 22 13C22 8 18 2 18 2Z" fill="#FF6A1A"/>
              <path d="M18 17C18 17 10 14 7 18C5 21 7 24 10 23C12 22 13 20 14 18" fill="#FF6A1A" opacity=".8"/>
              <path d="M18 17C18 17 26 14 29 18C31 21 29 24 26 23C24 22 23 20 22 18" fill="#FF6A1A" opacity=".8"/>
              <circle cx="18" cy="19" r="2.5" fill="#FFFFFF"/>
            </svg>
            <h2 className="font-display font-extrabold text-[34px] leading-tight m-0">Come to a meeting</h2>
            <p className="text-[17px] leading-relaxed m-0" style={{ color: "#D5DFDA" }}>
              Tell us a little about your family and a leader will reply within 24 hours with what to bring and when to show up.
            </p>
          </div>
          <div style={{ flex: "1 1 320px" }}>
            {sent ? (
              <div className="flex flex-col items-center gap-4 text-center py-8">
                <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#FF6A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <p className="font-bold text-[18px] m-0">Request sent!</p>
                <p className="text-[15px] m-0" style={{ color: "#9DB0A7" }}>A leader will be in touch soon. We&apos;re looking forward to meeting your family.</p>
              </div>
            ) : (
              <form onSubmit={handleJoin} className="flex flex-col gap-3">
                {[
                  { id: "pn", label: "Parent name", type: "text", val: parentName, set: setParentName, placeholder: "Jane Smith" },
                  { id: "em", label: "Email", type: "email", val: email, set: setEmail, placeholder: "jane@example.com" },
                  { id: "gr", label: "Scout's grade", type: "text", val: grade, set: setGrade, placeholder: "5th grade" },
                ].map((f) => (
                  <div key={f.id} className="flex flex-col gap-1.5">
                    <label htmlFor={f.id} className="font-bold text-[15px]">{f.label}</label>
                    <input id={f.id} type={f.type} required placeholder={f.placeholder} value={f.val}
                      onChange={(e) => f.set(e.target.value)}
                      className="min-h-[48px] rounded-xl px-4 text-[16px]"
                      style={{ border: "2px solid #4D5F57", background: "rgba(255,255,255,0.08)", color: "#FFFFFF", fontFamily: "inherit" }} />
                  </div>
                ))}
                <button type="submit" disabled={sending}
                  className="min-h-[52px] rounded-full font-bold text-[17px] border-none cursor-pointer disabled:opacity-50 mt-1"
                  style={{ background: "#FF6A1A", color: "#14211B", fontFamily: "inherit" }}>
                  {sending ? "Sending…" : "Request to join"}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: "#1F5F4A", color: "#CFE3DA" }}>
        <div className="max-w-5xl mx-auto px-5 py-5 flex flex-wrap gap-4 items-center justify-between text-sm">
          <span>{org.slug}</span>
          <div className="flex gap-4 items-center">
            <span>Powered by ScoutPlatform</span>
            <a href="/login" className="underline" style={{ color: "#CFE3DA" }}>Leader sign in</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

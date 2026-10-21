"use client";

import { useState } from "react";
import Link from "next/link";

const FEATURES = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
      </svg>
    ),
    title: "RSVP in seconds",
    body: "Families tap yes or no from their phone. No logins, no PDFs, no reply-all emails.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>
      </svg>
    ),
    title: "Collect money without the drama",
    body: "Charge for campouts, dues, and uniforms. Parents pay by card. You see who paid and who hasn't — no spreadsheet needed.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
    title: "Roster built for two-deep",
    body: "Track every leader's YPT expiry. See at a glance if you're covered for every activity — BSA two-deep enforced by design.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
    title: "Forms, tracked",
    body: "Health forms A, B, and C. Permission slips. Background checks. One place — no more 'did Tommy turn in his form?'",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8 19.79 19.79 0 01.38 1.2 2 2 0 012.36 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.16 6.16l1.27-.77a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
      </svg>
    ),
    title: "Text + email in one tap",
    body: "Message your whole troop, one patrol, or one family. Delivered by SMS and email. No group chat chaos.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    title: "Scoutbook import",
    body: "Upload your Scoutbook export and your roster, ranks, and merit badges come with you. Nothing typed twice.",
  },
];

// Only claims we can source. TroopWebHost facts come from its public help pages and
// unit-leader forum posts (Oct 2026); re-check before changing.
const COMPARISON = [
  ["", "ScoutPlatform", "TroopWebHost"],
  ["Price", "$125 / year flat, custom address included", "$109 / year, plus about $25 for a custom domain*"],
  ["Built for phones", "Phone-first, installs to the home screen", "Leaders describe the app as slow to load and the site as dated"],
  ["Scoutbook", "Imports Scoutbook exports; Scoutbook-ready advancement files out", "Imports Scoutbook exports; exports an Internet Advancement file"],
  ["Linked troops (boy/girl, troop + pack)", "Shared calendar", "Yes"],
  ["Your data", "One-click download of everything", "Export tools per area"],
];

const ONLY_HERE = [
  ["Every message to a Scout is logged and copied", "Tamper-proof log; parents and designated leaders are always copied. No private one-on-one threads."],
  ["Health forms without storing them", "Leaders mark Parts A, B and C received with an expiry date. The form itself never gets uploaded, as council guidance asks."],
  ["Youth Protection lockout", "A leader whose YPT has lapsed loses access to private kid data until it is renewed."],
  ["Sign up and pay in one flow", "RSVP, permission slip and Stripe payment from one link. Money goes straight to your troop's own account."],
  ["Works at the campsite", "The printable trip sheet and attendance open offline."],
  ["Troop-run extras", "QR check-in, calendar feed to Google and Apple, Court of Honor planner, recharter checklist, adult skills inventory, discussion boards."],
];

export default function LandingPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-paper" style={{ color: "#14211B", fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Top nav ── */}
      <header className="bg-forest text-white sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white text-forest flex items-center justify-center font-display font-extrabold text-sm flex-none">
              SP
            </div>
            <span className="font-display font-extrabold text-[20px]">ScoutPlatform</span>
          </div>
          <nav className="hidden md:flex items-center gap-1">
            {[["#features","Features"],["#how","How it works"],["#compare","Compare"],["#pricing","Pricing"]].map(([href, label]) => (
              <a key={href} href={href}
                className="text-white font-bold text-[15px] no-underline hover:underline min-h-[44px] flex items-center px-2">
                {label}
              </a>
            ))}
            <Link href="/login"
              className="ml-3 text-white font-bold text-[15px] no-underline hover:underline min-h-[44px] flex items-center px-2">
              Sign in
            </Link>
            <Link href="/setup"
              className="ml-2 min-h-[44px] px-5 rounded-full font-bold text-[15px] flex items-center no-underline"
              style={{ background: "#FF6A1A", color: "#14211B" }}>
              Start free
            </Link>
          </nav>
          <button className="md:hidden text-white" onClick={() => setMobileNavOpen(!mobileNavOpen)}
            aria-label="Toggle navigation">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              {mobileNavOpen
                ? <><path d="M18 6L6 18"/><path d="M6 6l12 12"/></>
                : <><path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/></>}
            </svg>
          </button>
        </div>
        {mobileNavOpen && (
          <div className="md:hidden bg-forest-deep px-5 pb-4 flex flex-col gap-1">
            {[["#features","Features"],["#how","How it works"],["#pricing","Pricing"],
              ["/login","Sign in"],["/setup","Start free — 30 days free"]].map(([href, label]) => (
              <a key={href} href={href}
                onClick={() => setMobileNavOpen(false)}
                className="text-white font-bold text-[16px] no-underline min-h-[44px] flex items-center">
                {label}
              </a>
            ))}
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <section className="bg-forest text-white overflow-hidden">
        <div className="max-w-5xl mx-auto px-5 pt-14 pb-16 flex flex-wrap gap-10 items-center">
          <div className="flex flex-col gap-6" style={{ flex: "1 1 380px" }}>
            {/* Scout fleur-de-lis accent */}
            <div className="flex items-center gap-3">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
                <path d="M18 2 C18 2 14 8 14 13 C14 16 16 17 18 17 C20 17 22 16 22 13 C22 8 18 2 18 2Z" fill="#FF6A1A"/>
                <path d="M18 17 C18 17 10 14 7 18 C5 21 7 24 10 23 C12 22 13 20 14 18" fill="#FF6A1A" opacity=".7"/>
                <path d="M18 17 C18 17 26 14 29 18 C31 21 29 24 26 23 C24 22 23 20 22 18" fill="#FF6A1A" opacity=".7"/>
                <path d="M14 23 Q16 27 18 28 Q20 27 22 23" fill="none" stroke="#FF6A1A" strokeWidth="1.5"/>
                <circle cx="18" cy="19" r="2" fill="#FFFFFF" opacity=".9"/>
              </svg>
              <span className="font-bold text-[15px] tracking-wider uppercase" style={{ color: "#CFE3DA" }}>
                Built for Scouts BSA, Cubs, Venturing &amp; more
              </span>
            </div>
            <h1 className="font-display font-extrabold leading-none m-0"
              style={{ fontSize: "clamp(44px, 7vw, 72px)" }}>
              Run your troop.<br />
              <span style={{ color: "#FF6A1A" }}>Not your inbox.</span>
            </h1>
            <p className="text-[19px] leading-relaxed m-0" style={{ color: "#CFE3DA", maxWidth: 460 }}>
              RSVP, collect payments, track forms, and message every family — in one place built for the way leaders actually work.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link href="/setup"
                className="min-h-[54px] px-7 rounded-full font-bold text-[18px] flex items-center no-underline gap-2"
                style={{ background: "#FF6A1A", color: "#14211B" }}>
                Start your free 30 days
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </Link>
              <a href="#features"
                className="min-h-[54px] px-7 rounded-full font-bold text-[18px] flex items-center no-underline"
                style={{ border: "2px solid rgba(255,255,255,0.4)", color: "#FFFFFF" }}>
                See features
              </a>
            </div>
            <p className="text-sm m-0" style={{ color: "#9DB0A7" }}>
              No credit card needed. $125/year, custom address included.
            </p>
          </div>

          {/* Right side — mock phone UI */}
          <div style={{ flex: "1 1 300px", minHeight: 340 }} className="flex items-center justify-center">
            <div className="rounded-3xl overflow-hidden shadow-2xl"
              style={{ width: 290, background: "#FFFFFF", border: "1px solid rgba(255,255,255,0.2)" }}>
              <div className="bg-forest px-4 py-3">
                <span className="text-white font-bold text-sm">Troop 999 · Plano</span>
              </div>
              <div className="p-4 flex flex-col gap-3">
                <div className="rounded-xl p-3 flex flex-col gap-1" style={{ background: "#FFF1E6", border: "1px solid #FFD6B8" }}>
                  <span className="font-bold text-[13px] text-orange-dark">ACTION NEEDED</span>
                  <span className="font-bold text-[16px]" style={{ color: "#14211B" }}>Pay for Caprock Campout</span>
                  <span className="text-[13px] text-smoke">$45.00 due Oct 20</span>
                  <button className="mt-1 min-h-[36px] rounded-full font-bold text-[13px]"
                    style={{ background: "#FF6A1A", color: "#14211B", border: "none", fontFamily: "inherit" }}>
                    Pay now
                  </button>
                </div>
                {[
                  { mon: "OCT", day: "22", title: "Troop Meeting", sub: "7 PM · Charter Org" },
                  { mon: "OCT", day: "23", title: "Caprock Campout", sub: "Oct 23–25 · 3 days" },
                  { mon: "NOV", day: "7", title: "Service Project", sub: "9 AM · Food bank" },
                ].map((ev) => (
                  <div key={ev.day + ev.title} className="flex gap-3 items-start">
                    <div className="flex flex-col items-center w-10 flex-none">
                      <span className="text-[10px] font-bold text-smoke">{ev.mon}</span>
                      <span className="font-display font-extrabold text-[22px] leading-none" style={{ color: "#14211B" }}>{ev.day}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-[14px]" style={{ color: "#14211B" }}>{ev.title}</span>
                      <span className="text-[12px] text-smoke">{ev.sub}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stat bar */}
        <div style={{ background: "rgba(0,0,0,0.25)", borderTop: "1px solid rgba(255,255,255,0.12)" }}>
          <div className="max-w-5xl mx-auto px-5 py-5 flex flex-wrap gap-x-10 gap-y-4">
            {[
              ["Installs", "no app store needed"],
              ["$125/yr", "flat — no per-seat fees"],
              ["30 days", "free to start"],
              ["5 min", "to set up your troop"],
            ].map(([n, label]) => (
              <div key={n} className="flex items-baseline gap-2">
                <span className="font-display font-extrabold text-[28px] leading-none" style={{ color: "#FF6A1A" }}>{n}</span>
                <span className="text-[15px]" style={{ color: "#CFE3DA" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="max-w-5xl mx-auto px-5 py-20 flex flex-col gap-10">
        <div className="flex flex-col gap-2">
          <span className="font-bold text-sm tracking-widest uppercase text-forest">Everything you need</span>
          <h2 className="font-display font-extrabold text-[38px] leading-tight m-0">
            Less admin. More Scouting.
          </h2>
          <p className="text-[18px] text-smoke max-w-xl m-0">
            We built every feature around one question: what would make a Scoutmaster's Thursday night easier?
          </p>
        </div>
        <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))" }}>
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white border border-border rounded-2xl p-5 flex flex-col gap-3">
              <span className="text-forest">{f.icon}</span>
              <span className="font-bold text-[18px]">{f.title}</span>
              <span className="text-smoke text-[15px] leading-relaxed">{f.body}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" style={{ background: "#EAF0ED" }}>
        <div className="max-w-5xl mx-auto px-5 py-20 flex flex-col gap-10">
          <div className="flex flex-col gap-2">
            <span className="font-bold text-sm tracking-widest uppercase text-forest">Setup in minutes</span>
            <h2 className="font-display font-extrabold text-[38px] leading-tight m-0">
              From zero to running in 5 minutes.
            </h2>
          </div>
          <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
            {[
              { n: "1", title: "Pick your program", body: "Scouts BSA, Cubs, Venturing, Sea Scouts, Trail Life, AHG — or any other youth group." },
              { n: "2", title: "Name your unit", body: "Enter your troop number and city. Your public page is live immediately." },
              { n: "3", title: "Import from Scoutbook", body: "Upload your Scoutbook export and your full roster comes with you. Or start fresh and add families as they join." },
              { n: "4", title: "Invite your families", body: "Share your join link. Parents create an account in 30 seconds — no app download required." },
            ].map((s) => (
              <div key={s.n} className="flex flex-col gap-3">
                <div className="w-12 h-12 rounded-full bg-forest text-white flex items-center justify-center font-display font-extrabold text-[22px] flex-none">
                  {s.n}
                </div>
                <span className="font-bold text-[18px]">{s.title}</span>
                <span className="text-smoke text-[15px] leading-relaxed">{s.body}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comparison ── */}
      <section id="compare" className="max-w-5xl mx-auto px-5 py-20 flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <span className="font-bold text-sm tracking-widest uppercase text-forest">Compare</span>
          <h2 className="font-display font-extrabold text-[38px] leading-tight m-0">
            Switching from TroopWebHost?<br />Here is what changes.
          </h2>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full border-collapse bg-white" style={{ minWidth: 500 }}>
            <thead>
              <tr style={{ background: "#14211B", color: "#FFFFFF" }}>
                {COMPARISON[0].map((h, i) => (
                  <th key={h} className="text-left p-4 font-bold text-[15px]"
                    style={{ borderRight: i < 2 ? "1px solid rgba(255,255,255,0.1)" : "none" }}>
                    {i === 1 ? (
                      <span className="flex items-center gap-2">
                        {h}
                        <span className="inline-flex items-center h-5 px-2 rounded-full text-[11px] font-bold"
                          style={{ background: "#FF6A1A", color: "#14211B" }}>
                          us
                        </span>
                      </span>
                    ) : h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON.slice(1).map((row, ri) => (
                <tr key={row[0]}
                  style={{ borderBottom: "1px solid #E6ECE9", background: ri % 2 === 0 ? "#FFFFFF" : "#F4F6F5" }}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="p-4 text-[15px]"
                      style={{ borderRight: ci < 2 ? "1px solid #E6ECE9" : "none",
                        fontWeight: ci === 0 ? 600 : 400,
                        color: ci === 1 ? "#1F5F4A" : ci === 2 ? "#4D5F57" : "#14211B" }}>
                      {ci === 1 && cell.startsWith("Yes")
                        ? <span className="flex items-center gap-1.5">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1F5F4A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
                            {cell}
                          </span>
                        : cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[13px] text-smoke m-0">
          *TroopWebHost details are from its public help pages and unit-leader forum posts, October 2026. Prices change, so confirm with each provider. Spot something out of date? Tell us and we will fix it.
        </p>
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))" }}>
          {ONLY_HERE.map(([t, b]) => (
            <div key={t} className="bg-white border border-border rounded-2xl p-5 flex flex-col gap-2">
              <span className="font-bold text-[17px]">{t}</span>
              <span className="text-smoke text-[15px] leading-relaxed">{b}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" style={{ background: "#EAF0ED" }}>
        <div className="max-w-5xl mx-auto px-5 py-20 flex flex-col gap-10">
          <div className="flex flex-col gap-2">
            <span className="font-bold text-sm tracking-widest uppercase text-forest">Simple pricing</span>
            <h2 className="font-display font-extrabold text-[38px] leading-tight m-0">
              One price. Everything included.
            </h2>
          </div>
          <div className="flex flex-wrap gap-5 items-start">
            {/* Main plan */}
            <div className="rounded-3xl p-8 flex flex-col gap-5 shadow-lg" style={{ flex: "1 1 300px", maxWidth: 440, background: "#14211B", color: "#FFFFFF" }}>
              <div>
                <span className="font-bold text-sm tracking-widest uppercase" style={{ color: "#9DB0A7" }}>ScoutPlatform</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-display font-extrabold text-[56px] leading-none">$125</span>
                  <span className="text-[18px]" style={{ color: "#9DB0A7" }}>/year</span>
                </div>
                <span className="text-[15px]" style={{ color: "#9DB0A7" }}>~$10/month · billed annually</span>
              </div>
              <ul className="flex flex-col gap-2 m-0 p-0 list-none">
                {["Unlimited members","RSVP + attendance tracking","Online payments via Stripe","Forms tracker","SMS + email messaging","Scoutbook import","Public troop page","Mobile-installable PWA"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-[15px]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF6A1A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/setup"
                className="min-h-[52px] rounded-full font-bold text-[17px] flex items-center justify-center no-underline mt-2"
                style={{ background: "#FF6A1A", color: "#14211B" }}>
                Start free — 30 days
              </Link>
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-4" style={{ flex: "1 1 240px", paddingTop: 8 }}>
              {[
                { icon: "🏦", title: "Troop money is separate", body: "Payments collected for events go into your troop's Stripe account, not ours. We never touch your troop's money." },
                { icon: "👨‍👩‍👧", title: "Free for families", body: "Only the troop pays the subscription. Every parent and Scout in your troop uses the app at no charge." },
                { icon: "📦", title: "No contracts", body: "Pay year-to-year. Cancel any time and your data exports cleanly." },
              ].map((n) => (
                <div key={n.title} className="flex gap-3">
                  <span className="text-2xl flex-none">{n.icon}</span>
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-[16px]">{n.title}</span>
                    <span className="text-[14px] text-smoke leading-relaxed">{n.body}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="bg-forest text-white">
        <div className="max-w-5xl mx-auto px-5 py-20 flex flex-col items-center text-center gap-6">
          <svg width="52" height="52" viewBox="0 0 36 36" fill="none" aria-hidden="true">
            <path d="M18 2 C18 2 14 8 14 13 C14 16 16 17 18 17 C20 17 22 16 22 13 C22 8 18 2 18 2Z" fill="#FF6A1A"/>
            <path d="M18 17 C18 17 10 14 7 18 C5 21 7 24 10 23 C12 22 13 20 14 18" fill="#FF6A1A" opacity=".8"/>
            <path d="M18 17 C18 17 26 14 29 18 C31 21 29 24 26 23 C24 22 23 20 22 18" fill="#FF6A1A" opacity=".8"/>
            <circle cx="18" cy="19" r="2.5" fill="#FFFFFF"/>
          </svg>
          <h2 className="font-display font-extrabold leading-tight m-0" style={{ fontSize: "clamp(32px, 5vw, 54px)" }}>
            Your troop deserves<br />better than a spreadsheet.
          </h2>
          <p className="text-[19px] m-0 max-w-xl" style={{ color: "#CFE3DA" }}>
            Set up your troop in 5 minutes. First 30 days are free. No credit card.
          </p>
          <Link href="/setup"
            className="min-h-[58px] px-10 rounded-full font-bold text-[19px] flex items-center gap-2 no-underline"
            style={{ background: "#FF6A1A", color: "#14211B" }}>
            Get started
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </Link>
          <p className="text-sm m-0" style={{ color: "#9DB0A7" }}>
            Scouts BSA · Cub Scouts · Venturing · Sea Scouts · Trail Life · AHG · Any youth group
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: "#0E1C15", color: "#9DB0A7" }}>
        <div className="max-w-5xl mx-auto px-5 py-8 flex flex-wrap gap-6 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-forest text-white flex items-center justify-center font-display font-extrabold text-xs">
              SP
            </div>
            <span className="font-bold text-[15px] text-white">ScoutPlatform</span>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <a href="#features" className="hover:text-white no-underline" style={{ color: "#9DB0A7" }}>Features</a>
            <a href="#pricing" className="hover:text-white no-underline" style={{ color: "#9DB0A7" }}>Pricing</a>
            <Link href="/login" className="hover:text-white no-underline" style={{ color: "#9DB0A7" }}>Sign in</Link>
            <Link href="/setup" className="hover:text-white no-underline" style={{ color: "#9DB0A7" }}>Get started</Link>
          </div>
          <span className="text-sm">
            Not affiliated with Scouting America.
          </span>
        </div>
      </footer>
    </div>
  );
}

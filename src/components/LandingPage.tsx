import Link from "next/link";
import Mark from "@/components/Mark";

// Public marketing page. Every claim about other products is sourced (public help pages and
// unit-leader forum posts, Oct 2026); keep it that way. No invented testimonials.

const FLOAT = { boxShadow: "0 1px 2px rgba(16,27,45,.06), 0 10px 28px rgba(16,27,45,.10)" };
const HERO_SHADOW = { boxShadow: "0 2px 4px rgba(16,27,45,.08), 0 24px 60px rgba(16,27,45,.22)" };

// Feature cards are written to one person each: what their week looks like with the app.
const TOOLS = [
  { who: "For the Scoutmaster", title: "Walk into every campout knowing you're ready.", body: "Who's going, who's paid, who's missing a health form, whether you have two-deep leadership. It's all on one screen days ahead, not discovered at the trailhead.",
    perks: ["Trip roster and trip sheet ready to print", "Reminders go only to families who haven't answered", "Copy last year's campout in one click"], icon: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" },
  { who: "For parents", title: "Sign up, pay and you're done. From your phone.", body: "Tap the link, check who's going, pay with Apple Pay or card. Your Scout's schedule, balance and progress live in one place, and every message to your Scout comes to you too.",
    perks: ["No app to download, no forms to print", "Allergy notes carry over trip to trip", "See what your Scout is working on next"], icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z" },
  { who: "For the treasurer", title: "Stop collecting checks at the back of the room.", body: "Families pay when they sign up, straight into the troop's own bank account. You see who owes in one list and remind all of them with one message.",
    perks: ["Card, Apple Pay, cash or check", "Yearly dues charged in one step", "Scout accounts for fundraising credit"], icon: "M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" },
  { who: "For the advancement chair", title: "Court of Honor prep without the scramble.", body: "Leaders sign off in a tap, the app keeps count of what Scoutbook is missing, and one file catches it up. The Scout Shop list, the program and the award labels print themselves.",
    perks: ["Sign-offs waiting, all in one place", "Merit badge counselors sign only their badges", "Eagle candidates and their deadlines at a glance"], icon: "M12 15a6 6 0 100-12 6 6 0 000 12zM8.5 14L7 22l5-3 5 3-1.5-8" },
  { who: "For Scouts", title: "Scouts answer for themselves. On their own phone.", body: "No more waiting on Mom to check her email. Scouts tap \"I'm going\", see what they need for their next rank, and ask for sign-offs themselves. Parents still OK anything that costs money, and see every message.",
    perks: ["Their own login (with a parent's OK under 13)", "Sign up for trips in a tap", "See their next rank and ask for sign-offs", "Patrol leaders message their own patrol"], icon: "M4 21V5m0 0h11l-2 4 2 4H4" },
  { who: "For the committee", title: "A troop new families can find, and want to join.", body: "Your troop gets its own website with your calendar and a join button. New families ask to join, you approve them, and they can sign up for their first campout right away.",
    perks: ["Public pages and members-only pages", "Invite every family with one link", "Run it next to your old system until you're ready"], icon: "M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" },
];

const COMPARE: [string, string, string][] = [
  ["Price", "$125 a year, your own web address included", "$109 a year, plus about $25 for a custom domain*"],
  ["For leaders at a desk", "Full dashboard: roster, money, advancement, reports", "Full feature set; users call the design dated*"],
  ["For parents on a phone", "Works in the phone's browser and installs to the home screen", "Separate app; a leader called it slow to load*"],
  ["Scoutbook", "Imports Scoutbook files and tracks what still needs uploading", "Imports Scoutbook files and exports an advancement file*"],
  ["Messages to Scouts", "Logged, can't be edited, copied to parents and leaders", "Not described in its public help pages"],
];

function Icon({ d }: { d: string }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="text-white sticky top-0 z-50" style={{ background: "linear-gradient(90deg, #0C2442 0%, #12355F 60%, #17437A 100%)", boxShadow: "inset 0 -3px 0 #F5B700" }}>
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 no-underline text-white flex-1">
            <Mark size={36} />
            <span className="hidden sm:inline font-display font-extrabold text-[19px]">Our Troop Manager</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-[15px] font-bold">
            <a href="#tools" className="text-white no-underline">Features</a>
            <a href="#leaders" className="text-white no-underline">For leaders</a>
            <a href="#compare" className="text-white no-underline">Compare</a>
            <a href="#pricing" className="text-white no-underline">Pricing</a>
          </nav>
          <Link href="/login" className="text-white font-bold text-[15px] no-underline min-h-[44px] flex items-center px-2 whitespace-nowrap">Sign in</Link>
          <Link href="/login?next=/setup" className="min-h-[44px] px-5 rounded-full font-bold text-[15px] flex items-center no-underline whitespace-nowrap" style={{ background: "#F5B700", color: "#101B2D" }}>Start free</Link>
        </div>
      </header>

      <div className="relative overflow-hidden">
      {/* Signature detail: faint topographic contour lines behind the hero. */}
      <svg aria-hidden="true" viewBox="0 0 1400 700" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.5 }}>
        <g fill="none" stroke="#CDBF9F" strokeWidth="1.3">
          <path d="M-50 600 C200 520 330 640 540 570 S880 440 1060 490 S1300 580 1460 500"/>
          <path d="M-50 540 C190 460 340 580 560 510 S870 380 1070 430 S1290 520 1460 440"/>
          <path d="M-50 480 C180 400 350 520 580 450 S860 320 1080 370 S1280 460 1460 380"/>
          <path d="M-50 420 C170 340 360 460 600 390 S850 260 1090 310 S1270 400 1460 320"/>
          <path d="M-50 360 C160 280 370 400 620 330 S840 200 1100 250 S1260 340 1460 260"/>
          <path d="M980 140 C1080 70 1220 80 1280 140 S1230 260 1120 250 S920 220 980 140Z"/>
          <path d="M1020 150 C1100 100 1200 110 1240 150 S1210 230 1130 225 S980 200 1020 150Z"/>
          <path d="M1070 158 C1120 130 1180 135 1200 160 S1180 200 1135 198 S1050 185 1070 158Z"/>
        </g>
        <path d="M640 690 C720 640 780 640 840 590 S980 470 1040 380 S1100 240 1135 170" fill="none" stroke="#F5B700" strokeWidth="3" strokeDasharray="2 12" strokeLinecap="round" opacity="0.8"/>
      </svg>
      <section className="relative max-w-6xl mx-auto px-5 pt-14 pb-16 flex flex-wrap gap-12 items-center">
        <div className="flex flex-col gap-6" style={{ flex: "1 1 440px" }}>
          <span className="eyebrow text-forest flex items-center gap-2"><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="#12355F" strokeWidth="2"/><path d="M12 4l2.5 8L12 20l-2.5-8z" fill="#F5B700"/></svg>For Scouts BSA troops</span>
          <h1 className="font-display font-extrabold leading-[1.02] m-0" style={{ fontSize: "clamp(42px, 6vw, 66px)" }}>
            Stop chasing parents.<br /><span className="text-forest relative inline-block">Start Scouting.<svg aria-hidden="true" viewBox="0 0 300 18" preserveAspectRatio="none" className="absolute left-0 -bottom-2 w-full h-[14px]"><path d="M3 12 C60 4 120 15 170 8 S260 4 297 9" fill="none" stroke="#F5B700" strokeWidth="5" strokeLinecap="round"/></svg></span>
          </h1>
          <p className="text-[19px] leading-relaxed text-smoke m-0 max-w-[520px]">
            Sign-ups, payments, permission slips and advancement in one place. Parents finish on their phone in a minute. You see who's in, who's paid and who's ready, without a single spreadsheet.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/login?next=/setup" className="min-h-[54px] px-8 rounded-full font-bold text-[17px] flex items-center no-underline" style={{ background: "#F5B700", color: "#101B2D" }}>Start your free 30 days</Link>
            <Link href="/demo/tour" className="min-h-[54px] px-7 rounded-full font-bold text-[17px] flex items-center no-underline text-forest" style={{ border: "2px solid #12355F" }}>See it in action</Link>
          </div>
          <span className="text-[14px] text-smoke">Free for 30 days, no credit card. Then $125 a year for the whole troop, every family included.</span>
        </div>

        <div className="rounded-[20px] overflow-hidden bg-white hero-float" style={{ flex: "1 1 460px", ...HERO_SHADOW }} aria-label="Example of the leader dashboard" role="img">
          <div className="bg-forest px-4 h-11 flex items-center gap-2">
            <Mark size={24} />
            <span className="text-white text-[13px] font-bold">Troop 999 · Leader tools</span>
          </div>
          <div className="flex">
            <div className="hidden sm:flex flex-col gap-1 p-3 w-32 bg-forest-deep">
              {["Overview", "People", "Calendar", "Advancement", "Safety", "Money"].map((l, i) => (
                <span key={l} className="text-[12px] px-2 py-1.5 rounded-md" style={i === 2 ? { background: "#12355F", color: "#fff", fontWeight: 700, boxShadow: "inset 2px 0 0 #F5B700" } : { color: "#D7E0EE" }}>{l}</span>
              ))}
            </div>
            <div className="flex-1 p-4 flex flex-col gap-3" style={{ background: "#E9E3D6" }}>
              <div className="patch !rounded-xl !p-3.5">
                <div className="eyebrow" style={{ color: "#F5B700" }}>Next up · Fri, Oct 23</div>
                <div className="font-display font-extrabold text-[17px]">Caprock Canyons campout</div>
                <div className="text-[12px]" style={{ color: "#D7E0EE" }}>24 going · 7 haven&apos;t answered · 2-deep covered</div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[["4", "forms missing"], ["$135", "still owed"], ["3", "sign-offs waiting"]].map(([n, l]) => (
                  <div key={l} className="bg-white rounded-xl p-2.5" style={FLOAT}>
                    <div className="font-display font-extrabold text-[18px]">{n}</div>
                    <div className="text-[11px] text-smoke">{l}</div>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-xl overflow-hidden" style={FLOAT}>
                {[["Jake G.", "Eagles", "On file", "Paid"], ["Ethan B.", "Eagles", "Needed", "Owes $45"], ["Priya S.", "Hawks", "On file", "Paid"]].map(([n, p, f, m]) => (
                  <div key={n} className="flex items-center gap-2 px-3 py-2 text-[12px] border-b border-[#EAE4D6] last:border-0">
                    <span className="font-bold flex-1">{n}</span><span className="text-smoke w-14">{p}</span>
                    <span className="px-2 py-0.5 rounded-full font-bold" style={f === "Needed" ? { background: "#FFF6D6", color: "#5E4400" } : { background: "#EEE8D9", color: "#12355F" }}>{f}</span>
                    <span className="px-2 py-0.5 rounded-full font-bold" style={m === "Paid" ? { background: "#EEE8D9", color: "#12355F" } : { background: "#FFF6D6", color: "#5E4400" }}>{m}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      </div>

      <section className="text-white" style={{ background: "var(--topo-dark), #0C2442", backgroundSize: "520px 520px", borderTop: "3px solid #F5B700", borderBottom: "3px solid #F5B700" }}>
        <div className="max-w-6xl mx-auto px-5 py-8 grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {[["Sign up and pay in one tap", "no more collecting checks at meetings"], ["Everyone ready to roll", "forms, payments and leaders checked for you"], ["Money straight to your troop", "card, Apple Pay, cash or check"], ["Scoutbook kept current", "one file brings it up to date"]].map(([a, b]) => (
            <div key={a} className="pl-4 border-l-2 border-dashed" style={{ borderColor: "rgba(245,183,0,.5)" }}><div className="font-display font-extrabold text-[22px]" style={{ color: "#F5B700" }}>{a}</div><div className="text-[15px]" style={{ color: "#D7E0EE" }}>{b}</div></div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 pt-20 flex flex-col gap-8">
        <div className="flex flex-col gap-2 max-w-2xl">
          <span className="eyebrow text-forest">Sound familiar?</span>
          <h2 className="font-display font-extrabold text-[40px] leading-tight m-0">You signed up to lead Scouts, not to run a back office.</h2>
        </div>
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {[["Who's coming Saturday?", "Replies scattered across email, texts and a sign-up sheet.", "Everyone answers in one place, and you see the list live."],
            ["Who still owes for summer camp?", "A spreadsheet only the treasurer understands.", "Families pay when they sign up. Who owes is one tap away."],
            ["Does everyone have a health form?", "You find out at the trailhead.", "Every trip shows who isn't cleared, days ahead."],
            ["Is Scoutbook up to date?", "Probably not, before the Court of Honor.", "One file catches it up, and the shopping list prints itself."]].map(([q, before, after]) => (
            <div key={q} className="card !rounded-[20px] !p-6 flex flex-col gap-3">
              <span className="font-bold text-[18px]">{q}</span>
              <span className="text-[14px] text-smoke line-through decoration-[#C9BFA8]">{before}</span>
              <span className="text-[15px] font-bold text-forest flex gap-2"><span aria-hidden="true" style={{ color: "#F5B700" }}>✓</span>{after}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="tools" className="max-w-6xl mx-auto px-5 py-20 flex flex-col gap-10">
        <div className="flex flex-col gap-2 max-w-2xl">
          <span className="eyebrow text-forest">Made for every volunteer</span>
          <h2 className="font-display font-extrabold text-[40px] leading-tight m-0">Less work for everyone who makes your troop run.</h2>
        </div>
        <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
          {TOOLS.map((t) => (
            <div key={t.who} className="card !rounded-[20px] !p-6 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                {/* Merit-badge style: round navy patch with a stitched gold ring. */}
                <span className="w-12 h-12 rounded-full flex items-center justify-center text-white relative flex-none" style={{ background: "#12355F", boxShadow: "0 0 0 3px #F5B700, 0 6px 14px rgba(12,36,66,.3)" }}>
                  <span aria-hidden="true" className="absolute inset-[5px] rounded-full border border-dashed" style={{ borderColor: "rgba(245,183,0,.6)" }} />
                  <Icon d={t.icon} />
                </span>
                <span className="eyebrow text-forest">{t.who}</span>
              </div>
              <span className="font-display font-extrabold text-[22px] leading-tight">{t.title}</span>
              <span className="text-[15px] leading-relaxed text-smoke">{t.body}</span>
              <ul className="m-0 p-0 list-none flex flex-col gap-1.5 mt-1">
                {t.perks.map((x) => <li key={x} className="flex gap-2 text-[14px] font-bold"><span aria-hidden="true" style={{ color: "#F5B700" }}>✓</span>{x}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section id="leaders" className="text-white" style={{ background: "var(--topo-dark), #0C2442", backgroundSize: "520px 520px" }}>
        <div className="max-w-6xl mx-auto px-5 py-20 flex flex-col gap-10">
          <div className="flex flex-col gap-2 max-w-3xl">
            <span className="eyebrow" style={{ color: "#F5B700" }}>For troop leaders</span>
            <h2 className="font-display font-extrabold text-[40px] leading-tight m-0">Here&apos;s what you can do, and what it saves you.</h2>
            <p className="text-[17px] m-0" style={{ color: "#D7E0EE" }}>Every job below is something a volunteer does by hand today. Our Troop Manager does it for you.</p>
          </div>
          <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
            {([
              ["Save hours every week", [
                ["Post a campout once", "Families sign up, sign the permission slip and pay in one go. No sign-up sheet to retype."],
                ["Let Scouts answer for themselves", "Scouts sign up from their own phone, so you're not waiting on a parent to relay it. Parents still approve the cost."],
                ["Remind only who hasn't answered", "One tap nudges the families still missing. Everyone else is left alone."],
                ["Know who's ready without checking", "Health forms, permission slips, payments and two-deep leadership are checked for every trip automatically."],
                ["Reuse last year's trips", "Copy an event and its whole trip plan: packing list, meals, duty roster."],
                ["Keep Scoutbook current with one file", "No double entry. The app tracks what Scoutbook is missing and gives you the upload file."],
                ["Print what you need", "Trip sheets, rosters, Court of Honor shopping lists, programs and award labels, ready to print."],
              ]],
              ["Save money every year", [
                ["One price for the whole troop", "$125 a year covers every family, leader and Scout, plus your troop website. No per-member fees."],
                ["Get paid up front", "Families pay when they sign up, so the troop isn't fronting money for campsites and food."],
                ["Nothing slips through the cracks", "See who owes in one list and remind all of them at once, instead of writing off unpaid balances."],
                ["You choose who pays card fees", "Pass the fee to families, or cover it. Cash and checks are always free."],
                ["Money goes to the troop's bank", "Card payments land in the troop's own account, not a volunteer's personal one."],
                ["No extra tools to pay for", "Sign-ups, payments, messages, website and advancement in one place, instead of a separate service for each."],
              ]],
            ] as [string, [string, string][]][]).map(([head, items]) => (
              <div key={head} className="rounded-[20px] p-6 md:p-8 flex flex-col gap-5" style={{ background: "rgba(255,255,255,.06)", boxShadow: "inset 0 0 0 1px rgba(245,183,0,.35)" }}>
                <span className="font-display font-extrabold text-[26px]" style={{ color: "#F5B700" }}>{head}</span>
                <ul className="m-0 p-0 list-none flex flex-col gap-4">
                  {items.map(([a, b]) => (
                    <li key={a} className="flex gap-3">
                      <span aria-hidden="true" className="font-bold" style={{ color: "#F5B700" }}>✓</span>
                      <span className="flex flex-col"><span className="font-bold text-[17px] text-white">{a}</span><span className="text-[15px]" style={{ color: "#D7E0EE" }}>{b}</span></span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <Link href="/login?next=/setup" className="min-h-[54px] px-8 rounded-full font-bold text-[17px] flex items-center no-underline" style={{ background: "#F5B700", color: "#101B2D" }}>Start your free 30 days</Link>
            <Link href="/demo/tour" className="min-h-[54px] px-7 rounded-full font-bold text-[17px] flex items-center no-underline text-white" style={{ border: "2px solid #F5B700" }}>See it in action</Link>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 py-20 flex flex-wrap gap-12 items-center">
        <div className="flex flex-col gap-5" style={{ flex: "1 1 380px" }}>
          <span className="eyebrow text-forest">What a parent sees</span>
          <h2 className="font-display font-extrabold text-[40px] leading-tight m-0">A text arrives. A minute later, they&apos;re signed up and paid.</h2>
          <ol className="m-0 p-0 list-none flex flex-col gap-4">
            {[["Tap the link", "It opens the trip: dates, cost, deadline and the refund rule, in plain words."],
              ["Pick who's going", "Their Scouts are already listed, and allergy notes carry over from the last trip."],
              ["Pay or OK it", "Apple Pay, card, or cash to a leader. If a Scout signed up, the parent just approves."]].map(([t, b], i) => (
              <li key={t} className="flex gap-4 items-start">
                <span className="w-9 h-9 rounded-full flex items-center justify-center font-display font-extrabold text-white flex-none" style={{ background: "#12355F" }}>{i + 1}</span>
                <span className="flex flex-col"><span className="font-bold text-[17px]">{t}</span><span className="text-[15px] text-smoke">{b}</span></span>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex justify-center" style={{ flex: "1 1 320px" }} role="img" aria-label="Example of the sign-up screen on a phone">
          <div className="rounded-[40px] p-3" style={{ background: "#101B2D", width: 300, ...HERO_SHADOW }}>
            <div className="rounded-[30px] overflow-hidden flex flex-col" style={{ background: "#E9E3D6", minHeight: 560 }}>
              <div className="px-5 pt-6 pb-5 text-white flex flex-col gap-1" style={{ background: "#12355F" }}>
                <span className="eyebrow" style={{ color: "#F5B700" }}>Fri, Oct 30 – Sun, Nov 1</span>
                <span className="font-display font-extrabold text-[20px] leading-tight">Caprock Canyons campout</span>
                <span className="text-[11px] font-bold mt-1 px-2 py-0.5 rounded-full self-start" style={{ background: "#F5B700", color: "#101B2D" }}>$45.00 per person</span>
              </div>
              <div className="p-3 flex flex-col gap-2.5">
                <div className="bg-white rounded-2xl p-3 flex flex-col gap-2" style={FLOAT}>
                  <span className="font-display font-extrabold text-[15px]">Who is going?</span>
                  {[["Jake", true], ["Maya", true], ["Tom (driving, 3 seats)", false]].map(([n, on]) => (
                    <div key={String(n)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-bold"
                      style={{ background: "#F8F5EE", boxShadow: on ? "inset 0 0 0 2px #12355F" : "inset 0 0 0 1px #DDD6C5" }}>
                      <span className="w-4 h-4 rounded flex-none" style={{ background: on ? "#12355F" : "#FFFFFF", border: on ? "none" : "2px solid #AEB9C9" }} />
                      <span className="flex-1">{n}</span>{on && <span className="text-smoke font-normal">$45</span>}
                    </div>
                  ))}
                </div>
                <div className="bg-white rounded-2xl p-3 flex flex-col gap-2" style={FLOAT}>
                  <div className="flex justify-between items-baseline"><span className="font-bold text-[13px]">Total</span><span className="font-display font-extrabold text-[22px]">$90.00</span></div>
                  <span className="rounded-full text-center text-white font-bold text-[13px] py-2.5" style={{ background: "#101B2D" }}>Pay with Apple Pay</span>
                  <span className="rounded-full text-center font-bold text-[13px] py-2.5" style={{ background: "#F5B700", color: "#101B2D" }}>Pay with card</span>
                  <span className="text-[10px] text-smoke text-center">Full refund until Oct 27, then half.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 pb-16 flex flex-col gap-4">
        <h2 className="font-display font-extrabold text-[26px] m-0">And everything else a troop runs on</h2>
        <ul className="m-0 p-0 list-none flex flex-wrap gap-2">
          {["Month calendar and calendar feeds", "Printable rosters and reports", "Update-all grid", "Eagle project tracker", "Patrol Leaders' Council space",
            "Patrol pages", "Trip plans, meals and duty rosters", "Copy last year's events", "Attendance with QR check-in", "Nights, miles and service hours tallied",
            "Court of Honor shopping list", "Recharter checklist", "Merit badge counselors", "Gear checkout and documents", "Volunteer shifts and polls",
            "Fundraising goals and QR donations", "Treasurer reports and budget", "Linked boys' and girls' troops", "Discussion boards", "Public troop website"].map((x) => (
            <li key={x} className="px-4 py-2 rounded-full bg-white text-[14px] font-bold" style={FLOAT}>{x}</li>
          ))}
        </ul>
      </section>

      <section id="compare" style={{ background: "#EEE8D9" }}>
        <div className="max-w-6xl mx-auto px-5 py-20 flex flex-col gap-8">
          <div className="flex flex-col gap-2 max-w-2xl">
            <span className="eyebrow text-forest">Compare</span>
            <h2 className="font-display font-extrabold text-[40px] leading-tight m-0">Switching from TroopWebHost? Here&apos;s what changes.</h2>
          </div>
          <div className="bg-white rounded-[20px] overflow-x-auto" style={FLOAT}>
            <table className="w-full border-collapse min-w-[640px]">
              <thead>
                <tr>
                  <th className="text-left p-4 w-[22%]" scope="col"><span className="sr-only">Topic</span></th>
                  <th className="text-left p-4 text-[15px] font-bold text-white bg-forest" scope="col">Our Troop Manager</th>
                  <th className="text-left p-4 text-[15px] font-bold" scope="col">TroopWebHost</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(([k, us, them]) => (
                  <tr key={k} className="border-t border-[#EAE4D6]">
                    <th scope="row" className="text-left p-4 text-[15px] font-bold align-top">{k}</th>
                    <td className="p-4 text-[15px] align-top" style={{ background: "#F8F5EE" }}>{us}</td>
                    <td className="p-4 text-[15px] text-smoke align-top">{them}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[13px] text-smoke m-0">*From TroopWebHost&apos;s public help pages and unit-leader forum posts, October 2026. Plenty of leaders like TroopWebHost and its support; confirm current details with them. Spot something out of date? Tell us and we&apos;ll fix it.</p>
        </div>
      </section>

      <section id="pricing" className="max-w-6xl mx-auto px-5 py-20 flex flex-wrap gap-10 items-center">
        <div className="patch !rounded-[24px] !p-9 flex flex-col gap-5" style={{ flex: "1 1 360px", maxWidth: 460 }}>
          <span className="eyebrow" style={{ color: "#F5B700" }}>One troop, one price</span>
          <div className="flex items-baseline gap-2"><span className="font-display font-extrabold text-[64px] leading-none">$125</span><span className="text-[18px]" style={{ color: "#D7E0EE" }}>a year</span></div>
          <ul className="m-0 p-0 list-none flex flex-col gap-2 text-[15px]">
            {["Unlimited members, families always free", "Payments, messaging, advancement and forms", "Your troop's own web address", "Download all your data any time", "First 30 days free, no credit card"].map((x) => (
              <li key={x} className="flex gap-2 items-start"><span style={{ color: "#F5B700" }} aria-hidden="true">✓</span>{x}</li>
            ))}
          </ul>
          <Link href="/login?next=/setup" className="min-h-[54px] rounded-full font-bold text-[17px] flex items-center justify-center no-underline" style={{ background: "#F5B700", color: "#101B2D" }}>Start your free 30 days</Link>
        </div>
        <div className="flex flex-col gap-5" style={{ flex: "1 1 360px" }}>
          <h2 className="font-display font-extrabold text-[36px] leading-tight m-0">Built to earn a volunteer&apos;s trust.</h2>
          {[
            ["No ads, no selling data", "This holds children's information. It's never for sale."],
            ["Troop money stays with the troop", "Card payments land in the troop's own Stripe account, never ours."],
            ["Safe for Scouts by design", "Messages to Scouts always copy their parents and leaders, and private details need current Youth Protection Training."],
            ["Real people answer", "Questions get a reply within 24 to 48 business hours."],
          ].map(([a, b]) => (
            <div key={a} className="flex flex-col gap-1"><span className="font-bold text-[17px]">{a}</span><span className="text-[15px] text-smoke">{b}</span></div>
          ))}
          <Link href="/safety" className="font-bold text-forest text-[16px]">How we protect Scouts&apos; data →</Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 pb-20">
        <div className="card !rounded-[24px] !p-8 md:!p-10 flex flex-wrap gap-6 items-center">
          <div className="flex flex-col gap-2" style={{ flex: "1 1 420px" }}>
            <h2 className="font-display font-extrabold text-[30px] leading-tight m-0">Your next campout could be the easy one.</h2>
            <p className="text-[16px] text-smoke m-0">Bring your roster and advancement over from Scoutbook or any spreadsheet, invite families with one link, and post your next trip. Try it free for 30 days. No credit card, and you can run it alongside what you use now.</p>
          </div>
          <Link href="/login?next=/setup" className="min-h-[54px] px-8 rounded-full font-bold text-[17px] flex items-center no-underline" style={{ background: "#F5B700", color: "#101B2D" }}>Start your free 30 days</Link>
        </div>
      </section>

      <footer style={{ background: "#091A30", color: "#AEB9C9" }}>
        <div className="max-w-6xl mx-auto px-5 py-8 flex flex-wrap gap-6 items-center justify-between text-[14px]">
          <span className="font-bold text-white">Our Troop Manager</span>
          <div className="flex gap-5 flex-wrap">
            <a href="#tools" className="no-underline" style={{ color: "#AEB9C9" }}>Features</a>
            <a href="#pricing" className="no-underline" style={{ color: "#AEB9C9" }}>Pricing</a>
            <Link href="/safety" className="no-underline" style={{ color: "#AEB9C9" }}>Safety and privacy</Link>
            <Link href="/help" className="no-underline" style={{ color: "#AEB9C9" }}>Help</Link>
            <Link href="/changes" className="no-underline" style={{ color: "#AEB9C9" }}>What&apos;s new</Link>
            <Link href="/login" className="no-underline" style={{ color: "#AEB9C9" }}>Sign in</Link>
          </div>
          <span>Not affiliated with Scouting America.</span>
        </div>
      </footer>
    </div>
  );
}

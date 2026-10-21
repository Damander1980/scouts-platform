import Link from "next/link";

// Public marketing page. Every claim about other products is sourced (public help pages and
// unit-leader forum posts, Oct 2026); keep it that way. No invented testimonials.

const FLOAT = { boxShadow: "0 1px 2px rgba(16,27,45,.06), 0 10px 28px rgba(16,27,45,.10)" };
const HERO_SHADOW = { boxShadow: "0 2px 4px rgba(16,27,45,.08), 0 24px 60px rgba(16,27,45,.22)" };

const TOOLS = [
  { title: "Events that fill themselves", body: "Families pick who's going, sign the permission slip and pay in one flow. You see who's in, who owes and who hasn't answered, and nudge only them.", icon: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" },
  { title: "Advancement, and Scoutbook kept current", body: "Scouts request sign-offs, leaders approve in one tap, and the app counts what isn't in Scoutbook yet. One file brings it up to date before a Court of Honor.", icon: "M12 15a6 6 0 100-12 6 6 0 000 12zM8.5 14L7 22l5-3 5 3-1.5-8" },
  { title: "Safety built in, not bolted on", body: "Every message to a Scout is logged and copied to parents and leaders. Leaders without current YPT lose access to kids' private details. Leader tools need two-step sign-in.", icon: "M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6zM9 12l2 2 4-4" },
  { title: "Health forms without storing them", body: "Leaders mark Parts A, B and C received with an expiry date. The form itself never gets uploaded, as councils ask, and every trip roster shows who isn't cleared.", icon: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 15l2 2 4-4" },
  { title: "Money your way", body: "Card through Stripe straight into the troop's own bank account, cash and check recorded by the treasurer, or both. Your troop decides who covers the card fee.", icon: "M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" },
  { title: "A public site that recruits", body: "Your troop page goes live at its own address with your calendar and a join button, so new families can find you and ask to join.", icon: "M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" },
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
      <header className="bg-forest text-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 no-underline text-white flex-1">
            <span className="w-9 h-9 rounded-[10px] flex items-center justify-center font-display font-extrabold" style={{ background: "#F5B700", color: "#101B2D" }}>S</span>
            <span className="hidden sm:inline font-display font-extrabold text-[19px]">ScoutPlatform</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-[15px] font-bold">
            <a href="#tools" className="text-white no-underline">Features</a>
            <a href="#compare" className="text-white no-underline">Compare</a>
            <a href="#pricing" className="text-white no-underline">Pricing</a>
          </nav>
          <Link href="/login" className="text-white font-bold text-[15px] no-underline min-h-[44px] flex items-center px-2 whitespace-nowrap">Sign in</Link>
          <Link href="/login?next=/setup" className="min-h-[44px] px-5 rounded-full font-bold text-[15px] flex items-center no-underline whitespace-nowrap" style={{ background: "#F5B700", color: "#101B2D" }}>Start free</Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-5 pt-14 pb-16 flex flex-wrap gap-12 items-center">
        <div className="flex flex-col gap-6" style={{ flex: "1 1 440px" }}>
          <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-forest">For Scouts BSA troops</span>
          <h1 className="font-display font-extrabold leading-[1.02] m-0" style={{ fontSize: "clamp(42px, 6vw, 66px)" }}>
            Less paperwork.<br /><span className="text-forest">More Scouting.</span>
          </h1>
          <p className="text-[19px] leading-relaxed text-smoke m-0 max-w-[520px]">
            One place for sign-ups, payments, health form status, advancement and messages. A real dashboard for leaders at the computer, and a simple page parents finish on their phone in a minute.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/login?next=/setup" className="min-h-[54px] px-8 rounded-full font-bold text-[17px] flex items-center no-underline" style={{ background: "#F5B700", color: "#101B2D" }}>Start your free 30 days</Link>
            <Link href="/demo/tour" className="min-h-[54px] px-7 rounded-full font-bold text-[17px] flex items-center no-underline text-forest" style={{ border: "2px solid #12355F" }}>See it in action</Link>
          </div>
          <span className="text-[14px] text-smoke">No credit card needed. $125 a year after that, for the whole troop.</span>
        </div>

        <div className="rounded-[20px] overflow-hidden bg-white" style={{ flex: "1 1 460px", ...HERO_SHADOW }} aria-label="Example of the leader dashboard" role="img">
          <div className="bg-forest px-4 h-11 flex items-center gap-2">
            <span className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-extrabold" style={{ background: "#F5B700", color: "#101B2D" }}>S</span>
            <span className="text-white text-[13px] font-bold">Troop 999 · Leader tools</span>
          </div>
          <div className="flex">
            <div className="hidden sm:flex flex-col gap-1 p-3 w-32 bg-forest-deep">
              {["Overview", "People", "Calendar", "Advancement", "Safety", "Money"].map((l, i) => (
                <span key={l} className="text-[12px] px-2 py-1.5 rounded-md" style={i === 2 ? { background: "#12355F", color: "#fff", fontWeight: 700, boxShadow: "inset 2px 0 0 #F5B700" } : { color: "#D7E0EE" }}>{l}</span>
              ))}
            </div>
            <div className="flex-1 p-4 flex flex-col gap-3" style={{ background: "#E9E3D6" }}>
              <div className="rounded-xl p-3.5 text-white" style={{ background: "#12355F" }}>
                <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#F5B700" }}>Next up · Fri, Oct 23</div>
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

      <section className="bg-forest text-white">
        <div className="max-w-6xl mx-auto px-5 py-8 grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {[["Every message logged", "and copied to parents and leaders"], ["No medical forms stored", "status and expiry only"], ["Money to your troop", "straight into its own bank account"], ["Your data is yours", "download everything any time"]].map(([a, b]) => (
            <div key={a}><div className="font-display font-extrabold text-[22px]" style={{ color: "#F5B700" }}>{a}</div><div className="text-[15px]" style={{ color: "#D7E0EE" }}>{b}</div></div>
          ))}
        </div>
      </section>

      <section id="tools" className="max-w-6xl mx-auto px-5 py-20 flex flex-col gap-10">
        <div className="flex flex-col gap-2 max-w-2xl">
          <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-forest">Leader power tools</span>
          <h2 className="font-display font-extrabold text-[40px] leading-tight m-0">Built for a Scoutmaster&apos;s Thursday night.</h2>
        </div>
        <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
          {TOOLS.map((t) => (
            <div key={t.title} className="bg-white rounded-[20px] p-6 flex flex-col gap-3" style={FLOAT}>
              <span className="w-11 h-11 rounded-xl flex items-center justify-center text-forest" style={{ background: "#EEE8D9" }}><Icon d={t.icon} /></span>
              <span className="font-bold text-[19px]">{t.title}</span>
              <span className="text-[15px] leading-relaxed text-smoke">{t.body}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 pb-16 flex flex-col gap-4">
        <h2 className="font-display font-extrabold text-[26px] m-0">And everything else a troop runs on</h2>
        <ul className="m-0 p-0 list-none flex flex-wrap gap-2">
          {["Month calendar and calendar feeds", "Printable rosters and reports", "Update-all grid", "Eagle project tracker", "Patrol Leaders' Council space",
            "Patrol pages", "Trip plans, meals and duty rosters", "Copy last year's events", "Attendance with QR check-in", "Nights, miles and service hours tallied",
            "Court of Honor shopping list", "Recharter checklist", "Merit badge counselors", "Gear checkout and documents", "Volunteer shifts and polls",
            "Fundraising goals and QR donations", "Treasurer reports and budget", "Linked troops and packs", "Discussion boards", "Public troop website"].map((x) => (
            <li key={x} className="px-4 py-2 rounded-full bg-white text-[14px] font-bold" style={FLOAT}>{x}</li>
          ))}
        </ul>
      </section>

      <section id="compare" style={{ background: "#EEE8D9" }}>
        <div className="max-w-6xl mx-auto px-5 py-20 flex flex-col gap-8">
          <div className="flex flex-col gap-2 max-w-2xl">
            <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-forest">Compare</span>
            <h2 className="font-display font-extrabold text-[40px] leading-tight m-0">Switching from TroopWebHost? Here&apos;s what changes.</h2>
          </div>
          <div className="bg-white rounded-[20px] overflow-x-auto" style={FLOAT}>
            <table className="w-full border-collapse min-w-[640px]">
              <thead>
                <tr>
                  <th className="text-left p-4 w-[22%]" scope="col"><span className="sr-only">Topic</span></th>
                  <th className="text-left p-4 text-[15px] font-bold text-white bg-forest" scope="col">ScoutPlatform</th>
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
        <div className="rounded-[24px] p-9 flex flex-col gap-5 text-white" style={{ flex: "1 1 360px", maxWidth: 460, background: "#12355F", ...HERO_SHADOW }}>
          <span className="text-[13px] font-bold uppercase tracking-[0.14em]" style={{ color: "#D7E0EE" }}>One troop, one price</span>
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
            ["Real people answer", "Questions get a reply within 24 to 48 business hours."],
          ].map(([a, b]) => (
            <div key={a} className="flex flex-col gap-1"><span className="font-bold text-[17px]">{a}</span><span className="text-[15px] text-smoke">{b}</span></div>
          ))}
          <Link href="/safety" className="font-bold text-forest text-[16px]">How we protect Scouts&apos; data →</Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 pb-20">
        <div className="bg-white rounded-[24px] p-8 md:p-10 flex flex-wrap gap-6 items-center" style={FLOAT}>
          <div className="flex flex-col gap-2" style={{ flex: "1 1 420px" }}>
            <h2 className="font-display font-extrabold text-[30px] leading-tight m-0">Bring your troop over by file.</h2>
            <p className="text-[16px] text-smoke m-0">Upload your Scoutbook roster and advancement exports, or any roster spreadsheet. You see a preview before anything is saved, and an import can be undone. Run both systems side by side until you&apos;re ready.</p>
          </div>
          <Link href="/login?next=/setup" className="min-h-[54px] px-8 rounded-full font-bold text-[17px] flex items-center no-underline" style={{ background: "#F5B700", color: "#101B2D" }}>Set up your troop</Link>
        </div>
      </section>

      <footer style={{ background: "#091A30", color: "#AEB9C9" }}>
        <div className="max-w-6xl mx-auto px-5 py-8 flex flex-wrap gap-6 items-center justify-between text-[14px]">
          <span className="font-bold text-white">ScoutPlatform</span>
          <div className="flex gap-5 flex-wrap">
            <a href="#tools" className="no-underline" style={{ color: "#AEB9C9" }}>Features</a>
            <a href="#pricing" className="no-underline" style={{ color: "#AEB9C9" }}>Pricing</a>
            <Link href="/safety" className="no-underline" style={{ color: "#AEB9C9" }}>Safety and privacy</Link>
            <Link href="/help" className="no-underline" style={{ color: "#AEB9C9" }}>Help</Link>
            <Link href="/login" className="no-underline" style={{ color: "#AEB9C9" }}>Sign in</Link>
          </div>
          <span>Not affiliated with Scouting America.</span>
        </div>
      </footer>
    </div>
  );
}

import Link from "next/link";

// Public tour linked from the landing page. Every screen behind it uses made-up data and saves nothing.
const GROUPS: { title: string; sub: string; screens: [string, string, string][] }[] = [
  {
    title: "For families", sub: "What parents and Scouts see, usually on a phone.",
    screens: [
      ["/demo", "Parent home", "What needs paying or answering, and what's coming up."],
      ["/demo/scout", "Scout home", "What an 11-year-old sees: one tap to say they're coming, and their advancement."],
      ["/demo/forum", "Discussion boards", "Group conversations, saved and never private."],
    ],
  },
  {
    title: "For leaders", sub: "The dashboard a Scoutmaster or treasurer uses at the computer.",
    screens: [
      ["/demo/leader", "Leader overview", "Quick actions, the next campout, Scoutbook status and what needs attention."],
      ["/demo/admin", "Members", "The roster, invites, join requests and Update all."],
      ["/demo/calendar", "Calendar", "The month at a glance, including events shared by a linked pack."],
      ["/demo/advancement", "Advancement", "Rank trail, next steps and merit badge progress for one Scout."],
      ["/demo/trip-sheet", "Trip sheet", "Printable campout list: who's going, drivers, health forms, YPT. Opens offline."],
      ["/demo/recharter", "Recharter helper", "The yearly renewal checklist."],
    ],
  },
];

export default function Tour() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="bg-forest text-white">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 no-underline text-white flex-1">
            <span className="w-9 h-9 rounded-[10px] flex items-center justify-center font-display font-extrabold" style={{ background: "#F5B700", color: "#101B2D" }}>S</span>
            <span className="hidden sm:inline font-display font-extrabold text-[19px]">ScoutPlatform</span>
          </Link>
          <Link href="/login?next=/setup" className="min-h-[44px] px-5 rounded-full font-bold text-[15px] flex items-center no-underline whitespace-nowrap" style={{ background: "#F5B700", color: "#101B2D" }}>Start free</Link>
        </div>
        <div className="max-w-5xl mx-auto px-5 pt-6 pb-10 flex flex-col gap-2">
          <h1 className="font-display font-extrabold text-[40px] leading-tight m-0">Take a look around</h1>
          <p className="text-[17px] m-0" style={{ color: "#D7E0EE" }}>Real screens with made-up families. Click anything; nothing here saves.</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-10 flex flex-col gap-10">
        {GROUPS.map((g) => (
          <section key={g.title} className="flex flex-col gap-4">
            <div>
              <h2 className="font-display font-extrabold text-[26px] m-0">{g.title}</h2>
              <p className="text-[15px] text-smoke m-0 mt-1">{g.sub}</p>
            </div>
            <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
              {g.screens.map(([href, title, sub]) => (
                <Link key={href} href={href} className="card no-underline text-ink flex flex-col gap-2 min-h-[120px]">
                  <span className="font-bold text-[18px]">{title}</span>
                  <span className="text-[14px] text-smoke flex-1">{sub}</span>
                  <span className="text-[14px] font-bold text-forest">Open →</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
        <div className="rounded-[20px] p-7 flex flex-wrap items-center gap-5 text-white" style={{ background: "#12355F", boxShadow: "0 2px 4px rgba(16,27,45,.08), 0 14px 32px rgba(16,27,45,.18)" }}>
          <div className="flex-1 min-w-[240px]">
            <div className="font-display font-extrabold text-[24px]">Ready to try it with your troop?</div>
            <div className="text-[15px]" style={{ color: "#D7E0EE" }}>First 30 days free. Bring your roster over from Scoutbook by file.</div>
          </div>
          <Link href="/login?next=/setup" className="min-h-[52px] px-7 rounded-full font-bold text-[16px] flex items-center no-underline" style={{ background: "#F5B700", color: "#101B2D" }}>Start your free 30 days</Link>
        </div>
      </main>
    </div>
  );
}

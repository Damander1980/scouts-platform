import Link from "next/link";

export const metadata = { title: "What's new" };

// Public changelog. Add newest entries at the top; keep each line something a volunteer would notice.
const ENTRIES: { date: string; items: string[] }[] = [
  { date: "October 21, 2026", items: [
    "New look: navy and gold, cleaner pages, and a leader sidebar grouped into seven sections.",
    "Sign in with email and password or Google. Leader tools now need two-step sign-in.",
    "Month calendar, copy an event (trip plan included), Directions and Add to my calendar on every event.",
    "Scoutbook: the app counts finished advancement that isn't uploaded yet and gives you a changes-only file.",
    "Scouts' paid sign-ups wait for a parent's OK; parents get a note and approve from home.",
    "Linked troops and packs: families can sign up for each other's shared events.",
    "Eagle project tracker, Patrol Leaders' Council space, patrol pages and duty rosters.",
    "Printable reports (YPT aging, patrol rosters, swim tests, participation and more) and an Update all grid.",
    "Treasurer: choose card, cash or both and who pays the card fee; message families who owe; block sign-ups over a balance.",
    "Reminders before health forms and YPT expire; urgent notices when an event is canceled or moved.",
    "Admins can review an activity log of who viewed private details.",
  ] },
];

export default function ChangesPage() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="bg-forest text-white">
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 no-underline text-white flex-1">
            <span className="w-9 h-9 rounded-[10px] flex items-center justify-center font-display font-extrabold" style={{ background: "#F5B700", color: "#101B2D" }}>S</span>
            <span className="hidden sm:inline font-display font-extrabold text-[19px]">ScoutPlatform</span>
          </Link>
          <Link href="/help" className="text-white font-bold text-[15px] no-underline min-h-[44px] flex items-center">Help</Link>
        </div>
        <div className="max-w-3xl mx-auto px-5 pt-6 pb-10">
          <h1 className="font-display font-extrabold text-[40px] leading-tight m-0">What&apos;s new</h1>
          <p className="text-[17px] m-0 mt-2" style={{ color: "#D7E0EE" }}>Improvements we ship, most recent first. Ideas come from the troops using it.</p>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-5 py-10 flex flex-col gap-5">
        {ENTRIES.map((e) => (
          <section key={e.date} className="card flex flex-col gap-3">
            <h2 className="font-display font-extrabold text-[22px] m-0">{e.date}</h2>
            <ul className="m-0 pl-5 flex flex-col gap-2 text-[15px] leading-relaxed">{e.items.map((i) => <li key={i}>{i}</li>)}</ul>
          </section>
        ))}
      </main>
    </div>
  );
}

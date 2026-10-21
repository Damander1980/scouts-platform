import Link from "next/link";

// One page that links every sample screen, for showing the platform on a phone. Sample data only.
const SCREENS: [string, string, string][] = [
  ["/demo/scout", "Scout home", "What an 11-year-old sees: one tap to say they're coming."],
  ["/demo", "Parent home", "What needs paying or answering, and what's coming up."],
  ["/demo/trip-sheet", "Trip sheet", "Printable list for a campout: who's going, drivers, health forms, YPT."],
  ["/demo/forum", "Discussion boards", "Group conversations. Saved forever, never private."],
  ["/demo/recharter", "Recharter helper", "The yearly renewal checklist."],
  ["/demo/admin", "Leader tools", "Members, money, advancement and more. Best on a computer."],
  ["/demo/advancement", "Advancement", "Rank and merit badge progress."],
];

export default function Tour() {
  return (
    <div className="min-h-screen bg-canvas p-4 max-w-xl mx-auto flex flex-col gap-3">
      <div>
        <h1 className="font-display font-extrabold text-[30px] m-0">Troop platform tour</h1>
        <p className="text-[15px] text-smoke m-0 mt-1">Sample screens with made-up data. Nothing here saves.</p>
      </div>
      {SCREENS.map(([href, title, sub]) => (
        <Link key={href} href={href} className="card no-underline text-ink flex flex-col gap-1" style={{ minHeight: 44 }}>
          <span className="font-bold text-[18px]">{title}</span>
          <span className="text-[14px] text-smoke">{sub}</span>
        </Link>
      ))}
    </div>
  );
}

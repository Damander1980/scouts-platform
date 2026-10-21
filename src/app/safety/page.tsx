import Link from "next/link";

export const metadata = { title: "Safety and privacy" };

// Plain-language account of how children's data is handled. Every line describes what the app
// actually does today; update it whenever the behavior changes.
const SECTIONS: { title: string; points: string[] }[] = [
  {
    title: "Messages to Scouts are never private",
    points: [
      "Every message to or from a Scout is saved and can't be edited, by anyone, including us.",
      "Each one is automatically copied to the Scout's parents and the troop's designated leaders.",
      "There are no one-on-one threads between an adult and a Scout. Replies go to the same group.",
      "Emails and texts only say a message is waiting; reading it needs a sign-in.",
    ],
  },
  {
    title: "Only trained, verified leaders see private details",
    points: [
      "Everyone in the troop can see the roster: names, patrols, ranks and positions.",
      "Birthdates, phone numbers, emails and health form status are limited to leaders the troop chooses.",
      "Those leaders also need current Youth Protection Training on file. When it lapses, access stops until it's renewed.",
      "Leader tools need two-step sign-in with an authenticator app.",
      "Each time a leader views someone else's private details, it is recorded.",
    ],
  },
  {
    title: "We don't store medical forms",
    points: [
      "Families download the blank Annual Health and Medical Record and hand the paper form to a designated leader.",
      "The leader marks Parts A, B and C received with an expiry date. Only that status is kept, as council guidance asks.",
    ],
  },
  {
    title: "Money goes to the troop",
    points: [
      "Card payments go through Stripe straight into the troop's own account. We never hold troop money.",
      "We never see or store card numbers.",
      "Cash and checks are always allowed and recorded by the treasurer.",
    ],
  },
  {
    title: "Parents stay in charge",
    points: [
      "Scouts under 13 get an account only when a parent creates it and gives consent.",
      "Parents decide whether their family's contact details appear on the roster, and whether a Scout's photo can be public.",
      "Only a parent or guardian can ask for their child's messages and data to be deleted.",
    ],
  },
  {
    title: "Your troop's data is yours",
    points: [
      "No ads. We never sell data.",
      "A troop admin can download all of the troop's data at any time.",
      "Every troop's data is walled off from every other troop at the database level.",
    ],
  },
];

export default function SafetyPage() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="bg-forest text-white">
        <div className="max-w-4xl mx-auto px-5 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 no-underline text-white flex-1">
            <span className="w-9 h-9 rounded-[10px] flex items-center justify-center font-display font-extrabold" style={{ background: "#F5B700", color: "#101B2D" }}>S</span>
            <span className="hidden sm:inline font-display font-extrabold text-[19px]">ScoutPlatform</span>
          </Link>
          <Link href="/login" className="text-white font-bold text-[15px] no-underline min-h-[44px] flex items-center whitespace-nowrap">Sign in</Link>
        </div>
        <div className="max-w-4xl mx-auto px-5 pt-6 pb-10">
          <h1 className="font-display font-extrabold text-[40px] leading-tight m-0">Safety and privacy</h1>
          <p className="text-[17px] m-0 mt-2 max-w-2xl" style={{ color: "#D7E0EE" }}>
            This platform holds children&apos;s information, so youth protection is built into how it works, not added on. Here is exactly what it does.
          </p>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-5 py-10 grid gap-5 md:grid-cols-2">
        {SECTIONS.map((s) => (
          <section key={s.title} className="card flex flex-col gap-3">
            <h2 className="font-display font-extrabold text-[21px] leading-tight m-0">{s.title}</h2>
            <ul className="m-0 pl-5 flex flex-col gap-2 text-[15px] leading-relaxed text-smoke">
              {s.points.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </section>
        ))}
        <p className="md:col-span-2 text-[13px] text-smoke m-0">
          Questions from a committee or chartered organization? We reply within 24 to 48 business hours. Not affiliated with Scouting America.
        </p>
      </main>
    </div>
  );
}

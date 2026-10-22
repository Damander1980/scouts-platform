import Link from "next/link";
import Mark from "@/components/Mark";

export const metadata = { title: "Help" };

// Short how-tos for volunteers. Keep every step true to the app as it is; update when screens change.
const GUIDES: { title: string; who: string; steps: string[] }[] = [
  { title: "Set up your troop", who: "First admin", steps: [
    "Sign in, choose Create an account if you're new, then start a troop.",
    "Enter your troop number, city and your Youth Protection Training expiration date.",
    "Import your roster: Leader tools → Unit → Import & export → upload the Scoutbook roster export.",
    "Add a second admin and two designated leaders on People → Members (the Overview checklist shows what's left).",
  ] },
  { title: "Invite families", who: "Admins", steps: [
    "People → Members → Invite families.",
    "Copy the invite link, or use Email the invite to open a ready-made message in your own email.",
    "Families create an account, add their kids and ask to join. Approve them when Members shows families waiting.",
  ] },
  { title: "Post an event and take sign-ups", who: "Leaders", steps: [
    "Calendar → Events → + New event, or Copy this event on last year's version (the trip plan comes along).",
    "Set the cost, sign-up deadline and refund rule. Families sign up and see their total right away.",
    "On the event page, Nudge sends a reminder only to families who haven't answered.",
  ] },
  { title: "Collect money", who: "Treasurer", steps: [
    "Unit → Settings → Money: choose card, cash and check, or both, and who pays the card fee.",
    "For card payments, connect the troop's bank account on Money (through Stripe). Money goes straight to the troop.",
    "Cash or a check: Money → Record cash or check. It shows in the family's history as manual.",
    "Money → Families lists who owes the most first; Message families who owe sends one reminder to all of them.",
  ] },
  { title: "Health forms", who: "Designated leaders", steps: [
    "Families download the blank Annual Health and Medical Record from Forms and hand you the paper form.",
    "Safety → Health forms & YPT: mark Parts A, B and C received and enter the expiry date. Never upload the form itself.",
    "Each event's roster shows who isn't cleared, and families get reminders 30 and 7 days before a form expires.",
  ] },
  { title: "Advancement and Scoutbook", who: "Leaders and advancement chair", steps: [
    "Scouts mark requirements done; Advancement shows everything waiting. Sign everything I can signs all at once.",
    "When Advancement says items aren't in Scoutbook yet, download the upload file and import it in Scoutbook Plus.",
    "Before a Court of Honor, print the shopping list and program from Advancement → Court of Honor list.",
  ] },
  { title: "Two-step sign-in", who: "Leaders, treasurers, admins", steps: [
    "The first time you open Leader tools, scan the QR code with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password).",
    "After that, enter the 6-digit code once per sign-in.",
    "New phone? Settings → Two-step sign-in → Move to a new phone (while you still have the old one).",
  ] },
  { title: "Youth protection, built in", who: "Everyone", steps: [
    "Every message to a Scout is saved and copied to their parents and the designated leaders. There are no private threads.",
    "Leaders without current YPT lose access to private details until it's renewed; reminders go out 30 and 7 days before.",
    "Admins can review who looked at private details under Safety → Activity log.",
  ] },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="bg-forest text-white">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 no-underline text-white flex-1">
            <Mark size={36} />
            <span className="hidden sm:inline font-display font-extrabold text-[19px]">ScoutPlatform</span>
          </Link>
          <Link href="/login" className="text-white font-bold text-[15px] no-underline min-h-[44px] flex items-center whitespace-nowrap">Sign in</Link>
        </div>
        <div className="max-w-5xl mx-auto px-5 pt-6 pb-10">
          <h1 className="font-display font-extrabold text-[40px] leading-tight m-0">How do I…</h1>
          <p className="text-[17px] m-0 mt-2" style={{ color: "#D7E0EE" }}>Short guides for the things volunteers do most. Still stuck? We reply within 24 to 48 business hours.</p>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-5 py-10 grid gap-5 md:grid-cols-2">
        {GUIDES.map((g) => (
          <section key={g.title} className="card flex flex-col gap-3">
            <div>
              <h2 className="font-display font-extrabold text-[21px] leading-tight m-0">{g.title}</h2>
              <span className="text-[13px] font-bold uppercase tracking-widest text-forest">{g.who}</span>
            </div>
            <ol className="m-0 pl-5 flex flex-col gap-2 text-[15px] leading-relaxed">
              {g.steps.map((s) => <li key={s}>{s}</li>)}
            </ol>
          </section>
        ))}
      </main>
    </div>
  );
}

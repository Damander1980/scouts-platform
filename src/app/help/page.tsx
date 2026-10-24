import Link from "next/link";
import { SECTIONS, ALL, type Block } from "./articles";
import HelpHeader from "./HelpHeader";
import HelpSearch from "./HelpSearch";

export const metadata = { title: "Help" };

const plain = (b: Block[]) => b.map((x) => ("p" in x ? x.p : "h" in x ? x.h : "tip" in x ? x.tip : "note" in x ? x.note : "steps" in x ? x.steps.join(" ") : x.list.join(" "))).join(" ");

export default function HelpPage() {
  const items = ALL.map((a) => ({ slug: a.slug, title: a.title, summary: a.summary, section: a.section.title,
    text: `${a.title} ${a.summary} ${a.who} ${plain(a.body)}`.toLowerCase() }));
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <HelpHeader>
        <div className="max-w-6xl mx-auto px-4 pt-6 pb-10 flex flex-col gap-4">
          <h1 className="font-display font-extrabold text-[36px] md:text-[40px] leading-tight m-0">How do I…</h1>
          <p className="text-[17px] m-0" style={{ color: "#D7E0EE" }}>Guides for parents, Scouts and volunteers. Still stuck? We reply within 24 to 48 business hours.</p>
          <HelpSearch items={items} />
        </div>
      </HelpHeader>
      <main className="max-w-6xl mx-auto px-4 py-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <section key={s.slug} className="card flex flex-col gap-3">
            <div>
              <h2 className="font-display font-extrabold text-[21px] leading-tight m-0">{s.title}</h2>
              <p className="text-[14px] text-smoke m-0 mt-1">{s.blurb}</p>
            </div>
            <ul className="m-0 p-0 list-none flex flex-col">
              {s.articles.map((a) => (
                <li key={a.slug}>
                  <Link href={`/help/${a.slug}`} className="flex items-center min-h-[44px] font-bold text-[15px] text-forest no-underline border-t border-[#EAE4D6]">{a.title}</Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}

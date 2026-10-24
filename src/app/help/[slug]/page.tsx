import Link from "next/link";
import { notFound } from "next/navigation";
import { ALL, SECTIONS, findArticle, type Block } from "../articles";
import HelpHeader from "../HelpHeader";

export function generateStaticParams() {
  return ALL.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const a = findArticle((await params).slug);
  return { title: a ? `${a.title} · Help` : "Help", description: a?.summary };
}

function Body({ blocks }: { blocks: Block[] }) {
  return (
    <div className="flex flex-col gap-4 text-[16px] leading-relaxed">
      {blocks.map((b, i) => {
        if ("h" in b) return <h2 key={i} className="font-display font-extrabold text-[22px] m-0 mt-2">{b.h}</h2>;
        if ("p" in b) return <p key={i} className="m-0">{b.p}</p>;
        if ("steps" in b) return <ol key={i} className="m-0 pl-6 flex flex-col gap-2">{b.steps.map((s) => <li key={s}>{s}</li>)}</ol>;
        if ("list" in b) return <ul key={i} className="m-0 pl-6 flex flex-col gap-1.5">{b.list.map((s) => <li key={s}>{s}</li>)}</ul>;
        if ("tip" in b) return <div key={i} className="rounded-xl px-4 py-3 text-[15px]" style={{ background: "#EAF0F7" }}><b>Tip: </b>{b.tip}</div>;
        return <div key={i} className="rounded-xl px-4 py-3 text-[15px]" style={{ background: "#FFF6D6", color: "#5E4400" }}><b>Good to know: </b>{b.note}</div>;
      })}
    </div>
  );
}

export default async function HelpArticle({ params }: { params: Promise<{ slug: string }> }) {
  const a = findArticle((await params).slug);
  if (!a) notFound();
  const siblings = a.section.articles;
  const next = siblings[siblings.findIndex((x) => x.slug === a.slug) + 1];
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <HelpHeader />
      <div className="max-w-6xl mx-auto px-4 py-8 grid gap-8 md:grid-cols-[240px_1fr]">
        <nav aria-label="Help topics" className="hidden md:flex flex-col gap-4 text-[14px]">
          {SECTIONS.map((s) => (
            <div key={s.slug}>
              <div className="eyebrow text-smoke mb-1">{s.title}</div>
              {s.articles.map((x) => (
                <Link key={x.slug} href={`/help/${x.slug}`} className="block py-1.5 no-underline"
                  style={{ color: x.slug === a.slug ? "#101B2D" : "#12355F", fontWeight: x.slug === a.slug ? 800 : 500 }}>{x.title}</Link>
              ))}
            </div>
          ))}
        </nav>
        <article className="card flex flex-col gap-5 min-w-0">
          <div className="text-[14px]"><Link href="/help" className="text-forest font-bold no-underline">Help</Link> <span className="text-smoke">/ {a.section.title}</span></div>
          <div>
            <h1 className="font-display font-extrabold text-[32px] md:text-[36px] leading-tight m-0">{a.title}</h1>
            <p className="text-[17px] text-smoke m-0 mt-2">{a.summary}</p>
            <span className="eyebrow text-forest block mt-2">For: {a.who}</span>
          </div>
          <Body blocks={a.body} />
          <div className="flex justify-between gap-3 flex-wrap border-t border-[#EAE4D6] pt-4">
            <Link href="/help" className="btn-secondary no-underline">All help topics</Link>
            {next && <Link href={`/help/${next.slug}`} className="btn-primary no-underline">Next: {next.title}</Link>}
          </div>
        </article>
      </div>
    </div>
  );
}

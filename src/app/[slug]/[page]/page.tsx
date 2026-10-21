import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SiteData } from "../TroopPageClient";
import { RenderBlocks, type Block } from "@/components/SiteBlocks";

async function load(slug: string, page: string) {
  const supabase = await createClient();
  const [{ data: site }, { data: pg }, { data: menu }] = await Promise.all([
    supabase.rpc("public_site", { p_slug: slug }),
    supabase.rpc("site_page", { p_slug: slug, p_page: page }),
    supabase.rpc("site_menu", { p_slug: slug }),
  ]);
  const p = ((pg ?? []) as { title: string; visibility: string; blocks: Block[] }[])[0];
  return { site: site as SiteData | null, page: p ?? null, menu: (menu ?? []) as { slug: string; title: string }[] };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; page: string }> }): Promise<Metadata> {
  const { slug, page } = await params;
  const d = await load(slug, page);
  if (!d.site?.org || !d.page) return {};
  return { title: `${d.page.title} · ${d.site.org.name}`, robots: d.page.visibility === "members" ? { index: false } : undefined };
}

export default async function SitePage({ params }: { params: Promise<{ slug: string; page: string }> }) {
  const { slug, page } = await params;
  const { site, page: p, menu } = await load(slug, page);
  // Members-only pages also come back empty for visitors, so they 404 instead of revealing the page exists.
  if (!site?.org || !p) notFound();
  const org = site.org;
  const brand = org.site?.brand_color && /^#[0-9a-f]{6}$/i.test(org.site.brand_color) ? org.site.brand_color : "#12355F";
  const storageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/site/`;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header style={{ background: brand }} className="text-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href={`/${org.slug}`} className="text-white no-underline font-display font-extrabold text-[20px]">{org.name}</Link>
        </div>
        <nav className="bg-black/15">
          <div className="max-w-4xl mx-auto px-4 h-11 flex items-center gap-5 text-[14px] font-bold overflow-x-auto whitespace-nowrap">
            <Link href={`/${org.slug}`} className="text-white no-underline">Home</Link>
            {menu.map((m) => (
              <Link key={m.slug} href={`/${org.slug}/${m.slug}`} className="text-white no-underline" style={{ opacity: m.slug === page ? 1 : 0.8, textDecoration: m.slug === page ? "underline" : undefined }}>{m.title}</Link>
            ))}
            <a href={`/join/${org.slug}`} className="ml-auto px-4 py-1.5 rounded-full no-underline" style={{ background: "#F5B700", color: "#101B2D" }}>Join us</a>
          </div>
        </nav>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-5">
        <h1 className="font-display font-extrabold text-[32px] m-0">{p.title}</h1>
        {p.visibility === "members" && <div className="text-[13px] font-bold text-smoke">Members-only page</div>}
        <RenderBlocks blocks={p.blocks ?? []} data={{
          brand, storageUrl, joinHref: `/join/${org.slug}`,
          events: site.events.map((e) => ({ id: e.id, title: e.title, start_at: e.start_at, location: e.location })),
          albums: site.albums,
        }} />
      </main>
    </div>
  );
}

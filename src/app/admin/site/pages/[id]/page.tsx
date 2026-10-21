import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/context";
import type { Block } from "@/components/SiteBlocks";
import PageEditor from "./PageEditor";

export default async function EditSitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, current } = await requirePerm("leader", "site.edit");
  const orgId = current.org.id;
  const { data: pg } = await supabase.from("web_pages").select("*").eq("id", id).eq("org_id", orgId).maybeSingle();
  if (!pg) notFound();
  const [{ data: versions }, { data: site }, { data: albums }] = await Promise.all([
    supabase.from("web_page_versions").select("id, title, published_at").eq("page_id", id).order("published_at", { ascending: false }).limit(20),
    supabase.rpc("public_site", { p_slug: current.org.slug }),
    supabase.from("albums").select("id, title, visibility").eq("org_id", orgId).order("taken_on", { ascending: false }),
  ]);
  const s = (site ?? {}) as { org?: { site?: { brand_color?: string } }; events?: { id: string; title: string; start_at: string; location: string | null }[]; albums?: { id: string; title: string; photos: { path: string; caption: string | null }[] }[] };
  const brand = s.org?.site?.brand_color && /^#[0-9a-f]{6}$/i.test(s.org.site.brand_color) ? s.org.site.brand_color : "#12355F";

  return (
    <PageEditor
      orgId={orgId} unitSlug={current.org.slug}
      page={{ id: pg.id, slug: pg.slug, title: pg.title, visibility: pg.visibility, show_in_menu: pg.show_in_menu, sort: pg.sort,
        draft: (pg.draft ?? []) as Block[], published: (pg.published ?? null) as Block[] | null, published_at: pg.published_at, updated_at: pg.updated_at }}
      versions={versions ?? []}
      albums={albums ?? []}
      preview={{ brand, storageUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/site/`, joinHref: `/join/${current.org.slug}`,
        events: s.events ?? [], albums: s.albums ?? [] }}
    />
  );
}

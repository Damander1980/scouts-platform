import Link from "next/link";
import { requirePerm } from "@/lib/context";
import { Chip } from "@/components/ui";
import NewPage from "./NewPage";

export default async function SitePages() {
  const { supabase, current } = await requirePerm("leader", "site.edit");
  const { data: pages } = await supabase.from("site_pages").select("id, slug, title, visibility, published_at, updated_at, sort, show_in_menu")
    .eq("org_id", current.org.id).order("sort").order("title");

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/site" className="text-[13px] font-bold text-forest no-underline">← Website</Link>
      <div>
        <h1 className="font-display font-extrabold text-[28px] m-0">Pages</h1>
        <p className="text-[14px] text-smoke m-0 mt-1">Extra pages for your site, built from blocks. Your home page is edited on the Website screen.</p>
      </div>
      <NewPage orgId={current.org.id} taken={(pages ?? []).map((p) => p.slug)} />
      {(pages ?? []).length === 0 && <div className="card text-smoke">No extra pages yet. Common ones: About us, What we do, New families, Eagle Scouts.</div>}
      {(pages ?? []).map((p) => {
        const changed = p.published_at && new Date(p.updated_at) > new Date(p.published_at);
        return (
          <Link key={p.id} href={`/admin/site/pages/${p.id}`} className="card flex items-center gap-2 flex-wrap no-underline text-ink">
            <b className="text-[16px]">{p.title}</b>
            <span className="text-[13px] text-smoke">/{current.org.slug}/{p.slug}</span>
            {p.visibility === "members" ? <Chip tone="dark">Members only</Chip> : <Chip>Public</Chip>}
            {!p.published_at ? <Chip tone="orange">Draft</Chip> : changed ? <Chip tone="orange">Unpublished changes</Chip> : <Chip tone="green">Live</Chip>}
            {!p.show_in_menu && <Chip>Hidden from menu</Chip>}
          </Link>
        );
      })}
    </div>
  );
}

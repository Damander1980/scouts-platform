import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TroopPageClient, { type SiteData } from "./TroopPageClient";

async function load(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_site", { p_slug: slug });
  return data as SiteData | null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await load(slug);
  if (!d?.org) return {};
  return { title: d.org.name, description: d.org.site?.welcome_text?.slice(0, 160) ?? `${d.org.name}, ${d.org.city ?? ""}` };
}

export default async function TroopPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await load(slug);
  if (!d?.org) notFound();
  const supabase = await createClient();
  const { data: menu } = await supabase.rpc("site_menu", { p_slug: slug });
  return <TroopPageClient data={d} menu={(menu ?? []) as { slug: string; title: string }[]} storageUrl={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/site/`} />;
}

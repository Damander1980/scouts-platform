import { createClient } from "@/lib/supabase/server";
import GiveClient from "./GiveClient";

export default async function GivePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ thanks?: string; booth?: string; src?: string }> }) {
  const { slug } = await params;
  const { thanks, booth, src } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_campaign", { p_slug: slug });
  const c = (data as { slug: string; title: string; description: string | null; target_cents: number | null; active: boolean; org_name: string; org_slug: string; raised: number; connected: boolean }[] | null)?.[0];

  if (!c || !c.active) {
    return <div className="min-h-screen flex items-center justify-center p-6 text-center bg-paper"><div className="card">This giving page isn&apos;t active.</div></div>;
  }
  return <GiveClient campaign={c} thanks={!!thanks} booth={!!booth} source={src ?? (booth ? "booth" : "link")} />;
}

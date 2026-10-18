import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TroopPageClient from "./TroopPageClient";

type Person = { first_name: string; last_name: string };

export default async function TroopPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, type, unit_number, city, state, slug, join_code, settings")
    .eq("slug", slug)
    .single();

  if (!org) notFound();

  // Upcoming events (public)
  const now = new Date().toISOString();
  const future = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: events } = await supabase
    .from("events")
    .select("id, title, start_at, end_at, location, cost_cents, cap")
    .eq("org_id", org.id)
    .gte("start_at", now)
    .lte("start_at", future)
    .order("start_at", { ascending: true })
    .limit(8);

  // Leaders (public names only)
  const { data: leaders } = await supabase
    .from("memberships")
    .select("role, persons(first_name, last_name)")
    .eq("org_id", org.id)
    .eq("status", "active")
    .in("role", [
      "scoutmaster", "assistant_scoutmaster", "committee_chair",
      "cubmaster", "crew_advisor", "skipper",
    ]);

  return (
    <TroopPageClient
      org={org}
      events={events ?? []}
      leaders={(leaders ?? []).map((m) => {
        const p = m.persons as unknown as Person | null;
        return { role: m.role, name: p ? `${p.first_name} ${p.last_name}` : "" };
      })}
    />
  );
}

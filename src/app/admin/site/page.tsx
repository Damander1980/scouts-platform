import { requireLeader } from "@/lib/context";
import SiteEditor from "./SiteEditor";

export default async function SitePage() {
  const { supabase, current, isAdmin } = await requireLeader();
  const orgId = current.org.id;
  const [{ data: org }, { data: members }, { data: albums }, { data: requests }] = await Promise.all([
    supabase.from("organizations").select("settings, slug").eq("id", orgId).single(),
    supabase.from("memberships").select("person_id, role, persons(first_name, last_name, type, photo_consent)").eq("org_id", orgId).eq("status", "active"),
    supabase.from("albums").select("id, title, taken_on, visibility, photos(id, path, caption, tagged, hidden)").eq("org_id", orgId).order("taken_on", { ascending: false }),
    supabase.from("contact_requests").select("id, name, email, phone, message, handled, created_at, to_person").eq("org_id", orgId).order("created_at", { ascending: false }).limit(50),
  ]);
  const people = ((members ?? []) as unknown as { person_id: string; role: string; persons: { first_name: string; last_name: string; type: string; photo_consent: boolean | null } }[])
    .map((m) => ({ id: m.person_id, name: `${m.persons.first_name} ${m.persons.last_name}`, type: m.persons.type, consent: m.persons.photo_consent, role: m.role }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <SiteEditor orgId={orgId} slug={org?.slug ?? current.org.slug} isAdmin={isAdmin}
      site={((org?.settings as Record<string, unknown>)?.site ?? {}) as Record<string, unknown>}
      settings={(org?.settings ?? {}) as Record<string, unknown>}
      people={people} albums={(albums ?? []) as never} requests={requests ?? []}
      storageUrl={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/site/`} />
  );
}

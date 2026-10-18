import { getContext, ROLE_LABELS } from "@/lib/context";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const ctx = await getContext();
  if (!ctx.current || !ctx.isLeader) return new Response("Forbidden", { status: 403 });
  const orgId = ctx.current.org.id;
  const { supabase } = ctx;

  const [{ data: ms }, { data: patrols }, { data: forms }, { data: positions }] = await Promise.all([
    supabase.from("memberships").select("person_id, role, status, position, ypt_expires, registration_expires, joined_at, persons(first_name, last_name, type, birthdate)").eq("org_id", orgId),
    supabase.from("patrol_members").select("person_id, role, patrols(name)").eq("org_id", orgId).is("end_date", null),
    supabase.from("forms").select("person_id, type, expires_at").eq("org_id", orgId),
    supabase.from("leadership_positions").select("person_id, title").eq("org_id", orgId).is("end_date", null),
  ]);
  const pat = Object.fromEntries((patrols ?? []).map((p) => [p.person_id, p]));
  const exp = (pid: string, t: string) => (forms ?? []).find((f) => f.person_id === pid && f.type === t)?.expires_at?.slice(0, 10) ?? "";

  const rows = (ms ?? []).map((m) => {
    const p = m.persons as unknown as { first_name: string; last_name: string; type: string; birthdate: string | null };
    return {
      "First name": p.first_name, "Last name": p.last_name, Type: p.type, Birthdate: p.birthdate ?? "",
      Role: ROLE_LABELS[m.role] ?? m.role, Status: m.status,
      Patrol: (pat[m.person_id]?.patrols as unknown as { name: string })?.name ?? "",
      "Youth position": (positions ?? []).filter((x) => x.person_id === m.person_id).map((x) => x.title).join("; "),
      "Adult position": m.position ?? "", "YPT expires": m.ypt_expires ?? "", "Registration expires": m.registration_expires ?? "",
      "Health A+B expires": exp(m.person_id, "health_ab"), "Health C expires": exp(m.person_id, "health_c"),
      Joined: m.joined_at?.slice(0, 10) ?? "",
    };
  });
  return new Response(toCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="roster-${ctx.current.org.slug}.csv"` } });
}

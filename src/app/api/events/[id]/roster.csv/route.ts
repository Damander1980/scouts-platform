import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: ev } = await supabase.from("events").select("id, org_id, title").eq("id", id).maybeSingle();
  if (!ev) return new Response("Not found", { status: 404 });
  const { data: leader } = await supabase.rpc("is_org_leader", { org: ev.org_id });
  if (!leader) return new Response("Forbidden", { status: 403 });

  const [{ data: rsvps }, { data: forms }, { data: patrols }] = await Promise.all([
    supabase.from("rsvps").select("person_id, status, driver_seats, dietary, notes, answers, persons(first_name, last_name, type)").eq("event_id", id),
    supabase.from("forms").select("person_id, type, expires_at").eq("org_id", ev.org_id),
    supabase.from("patrol_members").select("person_id, patrols(name)").eq("org_id", ev.org_id).is("end_date", null),
  ]);
  const patrolOf = Object.fromEntries((patrols ?? []).map((p) => [p.person_id, (p.patrols as unknown as { name: string })?.name ?? ""]));
  const formOk = (pid: string, t: string) => {
    const f = (forms ?? []).find((x) => x.person_id === pid && x.type === t);
    return f && (!f.expires_at || new Date(f.expires_at) > new Date()) ? "yes" : "NO";
  };

  const rows = (rsvps ?? []).map((r) => {
    const p = r.persons as unknown as { first_name: string; last_name: string; type: string };
    return {
      Name: `${p.first_name} ${p.last_name}`, Type: p.type, Patrol: patrolOf[r.person_id] ?? "", Status: r.status,
      "Health A+B": formOk(r.person_id, "health_ab"), "Health C": formOk(r.person_id, "health_c"), Permission: formOk(r.person_id, "permission"),
      "Driver seats": r.driver_seats || "", Dietary: r.dietary ?? "", Notes: r.notes ?? "",
      ...Object.fromEntries(Object.entries((r.answers ?? {}) as Record<string, string>)),
    };
  });
  const safe = ev.title.replace(/[^A-Za-z0-9]+/g, "-");
  return new Response(toCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${safe}-roster.csv"` } });
}

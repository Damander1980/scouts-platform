import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";
import { rsvpPrivate } from "@/lib/rsvpPrivate";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: ev } = await supabase.from("events").select("id, org_id, title").eq("id", id).maybeSingle();
  if (!ev) return new Response("Not found", { status: 404 });
  // Health form status, allergies and family notes are private details: current YPT and two-step sign-in
  // (has_perm checks both), like every other screen that shows them.
  const [{ data: priv }, { data: medical }] = await Promise.all([
    supabase.rpc("has_perm", { org: ev.org_id, perm: "members.private" }),
    supabase.rpc("has_perm", { org: ev.org_id, perm: "medical.view" }),
  ]);
  if (!priv && !medical) return new Response("Your Youth Protection Training must be current to download the trip roster.", { status: 403 });

  const [{ data: rsvps }, { data: forms }, { data: patrols }, details] = await Promise.all([
    supabase.from("rsvps").select("person_id, status, driver_seats, persons(first_name, last_name, type)").eq("event_id", id),
    supabase.from("forms").select("person_id, type, expires_at").eq("org_id", ev.org_id),
    supabase.from("patrol_members").select("person_id, patrols(name)").eq("org_id", ev.org_id).is("end_date", null),
    rsvpPrivate(supabase, { events: [id] }),
  ]);
  const privOf = Object.fromEntries(details.map((r) => [r.person_id, r]));
  const patrolOf = Object.fromEntries((patrols ?? []).map((p) => [p.person_id, (p.patrols as unknown as { name: string })?.name ?? ""]));
  const formOk = (pid: string, t: string) => {
    const ok = (forms ?? []).some((x) => x.person_id === pid && x.type === t && (!x.expires_at || new Date(x.expires_at) > new Date()));
    return ok ? "yes" : "NO";
  };

  const rows = (rsvps ?? []).map((r) => {
    const p = r.persons as unknown as { first_name: string; last_name: string; type: string };
    return {
      Name: `${p.first_name} ${p.last_name}`, Type: p.type, Patrol: patrolOf[r.person_id] ?? "", Status: r.status,
      "Health A+B": formOk(r.person_id, "health_ab"), "Health C": formOk(r.person_id, "health_c"), Permission: formOk(r.person_id, "permission"),
      "Driver seats": r.driver_seats || "", Dietary: privOf[r.person_id]?.dietary ?? "", Notes: privOf[r.person_id]?.notes ?? "",
      ...Object.fromEntries(Object.entries((privOf[r.person_id]?.answers ?? {}) as Record<string, string>)),
    };
  });
  const safe = ev.title.replace(/[^A-Za-z0-9]+/g, "-");
  return new Response(toCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${safe}-roster.csv"` } });
}

import { getContext } from "@/lib/context";
import { toCsv } from "@/lib/csv";

type Names = Record<string, { first_name: string; last_name: string }>;

async function names(supabase: Awaited<ReturnType<typeof getContext>>["supabase"], orgId: string): Promise<Names> {
  const { data } = await supabase.from("memberships").select("person_id, persons(first_name, last_name)").eq("org_id", orgId);
  return Object.fromEntries((data ?? []).map((m) => [m.person_id, m.persons as unknown as { first_name: string; last_name: string }]));
}

export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const ctx = await getContext();
  if (!ctx.current || !ctx.isLeader) return new Response("Forbidden", { status: 403 });
  const { supabase } = ctx;
  const orgId = ctx.current.org.id;
  const slug = ctx.current.org.slug;
  const csv = (rows: Record<string, unknown>[], name: string) =>
    new Response(toCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}-${slug}.csv"` } });

  if (kind === "advancement.csv") {
    const n = await names(supabase, orgId);
    const [{ data: adv }, { data: prog }] = await Promise.all([
      supabase.from("scout_advancement").select("person_id, status, completed_at, advancement_items(name, kind)").eq("org_id", orgId).eq("status", "completed"),
      supabase.from("requirement_progress").select("person_id, approved_at, advancement_requirements(number, advancement_items(name, kind))").eq("org_id", orgId).not("approved_by", "is", null),
    ]);
    const rows = [
      ...(adv ?? []).map((a) => {
        const it = a.advancement_items as unknown as { name: string; kind: string };
        return { "First Name": n[a.person_id]?.first_name, "Last Name": n[a.person_id]?.last_name, "Advancement Type": it.kind === "rank" ? "Rank" : it.kind === "badge" ? "Merit Badge" : "Adventure", Advancement: it.name, "Date Completed": a.completed_at?.slice(0, 10) };
      }),
      ...(prog ?? []).map((p) => {
        const r = p.advancement_requirements as unknown as { number: string; advancement_items: { name: string; kind: string } };
        return { "First Name": n[p.person_id]?.first_name, "Last Name": n[p.person_id]?.last_name, "Advancement Type": r.advancement_items.kind === "rank" ? "Rank Requirement" : r.advancement_items.kind === "badge" ? "Merit Badge Requirement" : "Adventure Requirement", Advancement: `${r.advancement_items.name} #${r.number}`, "Date Completed": p.approved_at?.slice(0, 10) };
      }),
    ];
    return csv(rows, "advancement");
  }

  if (kind === "ledger.csv") {
    const { data } = await supabase.from("ledger_entries").select("created_at, household_id, households(name), type, amount_cents, description, method, manual, stripe_pi_id, events(title)").eq("org_id", orgId).order("created_at");
    return csv((data ?? []).map((l) => ({
      Date: l.created_at.slice(0, 10), Family: (l.households as unknown as { name: string })?.name ?? "", Type: l.type,
      Amount: (l.amount_cents / 100).toFixed(2), Description: l.description ?? "", Event: (l.events as unknown as { title: string })?.title ?? "",
      Method: l.method ?? (l.stripe_pi_id ? "Stripe" : ""), Manual: l.manual ? "yes" : "", "Stripe ID": l.stripe_pi_id ?? "",
    })), "ledger");
  }

  if (kind === "attendance.csv") {
    const n = await names(supabase, orgId);
    const [{ data: att }, { data: credits }] = await Promise.all([
      supabase.from("attendance").select("person_id, present, events(title, start_at, overnight_nights, service_hours, miles)").eq("org_id", orgId),
      supabase.from("activity_credits").select("*").eq("org_id", orgId),
    ]);
    void credits;
    return csv((att ?? []).map((a) => {
      const e = a.events as unknown as { title: string; start_at: string; overnight_nights: number; service_hours: number; miles: number };
      return { "First Name": n[a.person_id]?.first_name, "Last Name": n[a.person_id]?.last_name, Event: e.title, Date: e.start_at.slice(0, 10), Present: a.present ? "yes" : "no", Nights: a.present ? e.overnight_nights : 0, "Service hours": a.present ? e.service_hours : 0, Miles: a.present ? e.miles : 0 };
    }), "attendance");
  }

  if (kind === "all") {
    const tables = ["memberships", "patrols", "patrol_members", "leadership_positions", "events", "attendance", "forms",
      "scout_advancement", "requirement_progress", "scout_certifications", "ledger_entries", "message_log", "join_requests"] as const;
    const out: Record<string, unknown> = { exported_at: new Date().toISOString(), unit: ctx.current.org };
    for (const t of tables) {
      const { data } = await supabase.from(t).select("*").eq("org_id", orgId);
      out[t] = data ?? [];
    }
    out.people = Object.entries(await names(supabase, orgId)).map(([id, p]) => ({ id, ...p }));
    return new Response(JSON.stringify(out, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="all-data-${slug}.json"` } });
  }

  return new Response("Not found", { status: 404 });
}

import { requirePerm, ROLE_LABELS } from "@/lib/context";
import RecharterClient, { type Person } from "./RecharterClient";

export default async function RecharterPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { year: y } = await searchParams;
  const { supabase, current, can } = await requirePerm("leader", "members.manage", "money.manage");
  const orgId = current.org.id;
  // Most units renew effective January 1, so the default is next year's charter once fall arrives.
  const now = new Date();
  const year = y && /^\d{4}$/.test(y) ? Number(y) : now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear();

  const [{ data: ms }, { data: rc }] = await Promise.all([
    supabase.from("memberships").select("role, status, ypt_expires, registration_expires, persons(id, first_name, last_name, type)").eq("org_id", orgId).eq("status", "active"),
    supabase.from("recharters").select("id, items, notes, due_on, submitted_at").eq("org_id", orgId).eq("charter_year", year).maybeSingle(),
  ]);

  const people: Person[] = ((ms ?? []) as unknown as { role: string; ypt_expires: string | null; registration_expires: string | null; persons: { id: string; first_name: string; last_name: string; type: string } }[])
    .filter((m) => m.persons)
    .map((m) => ({ id: m.persons.id, name: `${m.persons.first_name} ${m.persons.last_name}`, last: m.persons.last_name, type: m.persons.type, role: ROLE_LABELS[m.role] ?? m.role, ypt: m.ypt_expires, reg: m.registration_expires }))
    .sort((a, b) => a.type.localeCompare(b.type) || a.last.localeCompare(b.last));

  return (
    <RecharterClient
      orgId={orgId} year={year} canEdit={current.is_admin || can("members.manage", "money.manage")}
      people={people}
      recharter={(rc as { id: string; items: Record<string, { done: boolean; at?: string }>; notes: string | null; due_on: string | null; submitted_at: string | null } | null) ?? null}
    />
  );
}

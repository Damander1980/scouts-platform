import type { SupabaseClient } from "@supabase/supabase-js";

export type RsvpPrivate = { event_id: string; person_id: string; notes: string | null; dietary: string | null; answers: Record<string, string> | null; rsvp_at: string };

// Allergy notes, family notes and answers on sign-ups: only for that family and the event's leaders
// (migration 0073). Until the database is updated, the old direct read still works.
export async function rsvpPrivate(supabase: SupabaseClient, f: { org?: string; events?: string[]; persons?: string[] }) {
  const { data, error } = await supabase.rpc("rsvp_private", { p_org: f.org ?? null, p_event_ids: f.events ?? null, p_person_ids: f.persons ?? null });
  if (!error) return (data ?? []) as RsvpPrivate[];
  if (error.code !== "PGRST202") throw error;
  let q = supabase.from("rsvps").select("event_id, person_id, notes, dietary, answers, rsvp_at, events!inner(org_id)").order("rsvp_at", { ascending: false });
  if (f.org) q = q.eq("events.org_id", f.org);
  if (f.events) q = q.in("event_id", f.events);
  if (f.persons) q = q.in("person_id", f.persons);
  const { data: rows } = await q;
  return (rows ?? []) as unknown as RsvpPrivate[];
}

/** event_id:person_id -> private fields */
export const byKey = (rows: RsvpPrivate[]) => new Map(rows.map((r) => [`${r.event_id}:${r.person_id}`, r]));

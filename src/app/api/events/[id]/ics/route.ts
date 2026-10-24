import { getContext } from "@/lib/context";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

// One event as a calendar file, for "Add to my calendar" on the event page (members only, via RLS).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx.current) return new Response("Sign in first", { status: 401 });
  const { data: e } = await ctx.supabase.from("events").select("id, title, description, location, start_at, end_at, canceled").eq("id", id).maybeSingle();
  if (!e) return new Response("Not found", { status: 404 });
  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const end = e.end_at ?? new Date(new Date(e.start_at).getTime() + 90 * 60000).toISOString();
  const body = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//OurTroopManager//EN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:${e.id}@ourtroopmanager.com`, `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(e.start_at)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${esc((e.canceled ? "CANCELED: " : "") + e.title)}`,
    ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
    `DESCRIPTION:${esc(`${e.description ?? ""}\n\nDetails and sign-up: ${site}/events/${e.id}`)}`,
    `URL:${site}/events/${e.id}`, `STATUS:${e.canceled ? "CANCELLED" : "CONFIRMED"}`, "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const file = e.title.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "event";
  return new Response(body, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${file}.ics"` } });
}

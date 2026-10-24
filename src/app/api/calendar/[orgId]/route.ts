import { createClient } from "@supabase/supabase-js";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export async function GET(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const token = new URL(request.url).searchParams.get("t") ?? "";
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("calendar_feed", { p_org: orgId, p_token: token });
  if (error || !token) return new Response("Not found", { status: 404 });

  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const name = data?.[0]?.org_name ?? "Troop calendar";
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//OurTroopManager//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`, "X-PUBLISHED-TTL:PT1H", "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];
  for (const e of data ?? []) {
    const end = e.end_at ?? new Date(new Date(e.start_at).getTime() + 90 * 60000).toISOString();
    lines.push(
      "BEGIN:VEVENT", `UID:${e.id}@ourtroopmanager.com`, `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(e.start_at)}`, `DTEND:${stamp(end)}`,
      `SUMMARY:${esc((e.canceled ? "CANCELED: " : "") + e.title)}`,
      ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
      `DESCRIPTION:${esc(`${e.description ?? ""}\n\nRSVP: ${site}/events/${e.id}`)}`,
      `URL:${site}/events/${e.id}`, `STATUS:${e.canceled ? "CANCELLED" : "CONFIRMED"}`, "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.join("\r\n"), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `inline; filename="${orgId}.ics"`, "Cache-Control": "private, max-age=900" },
  });
}

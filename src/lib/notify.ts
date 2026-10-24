import { adminClient, SITE_URL } from "./admin";

type Category = "messages" | "reminders" | "deadlines" | "payments" | "digest" | "urgent";

async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { status: "skipped" as const };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || "ScoutPlatform <notify@scoutplatform.app>", to, subject, html }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.ok ? ("sent" as const) : ("failed" as const), id: body?.id as string | undefined };
}

export async function sendSms(to: string, text: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) return { status: "skipped" as const };
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: from, Body: text }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.ok ? ("sent" as const) : ("failed" as const), id: body?.sid as string | undefined };
}

function inQuietHours(start: string, end: string, tz: string) {
  const hm = new Date().toLocaleTimeString("en-US", { timeZone: tz, hour12: false, hour: "2-digit", minute: "2-digit" });
  return start > end ? hm >= start || hm < end : hm >= start && hm < end;
}

// Marks a one-time system notice as sent; false if it already was (a unique index makes this race-free).
export async function claimOnce(db: NonNullable<ReturnType<typeof adminClient>>, key: string) {
  // Look first so this still dedupes before the unique index exists; the index closes the race once it does.
  const { data: seen } = await db.from("notification_log").select("id").eq("category", key).eq("channel", "system").limit(1);
  if (seen?.length) return false;
  const { error } = await db.from("notification_log").insert({ category: key, channel: "system", status: "done" });
  if (!error) return true;
  if (error.code === "23505") return false; // someone else just claimed it
  throw new Error(`Could not record notice ${key}: ${error.message}`); // a real failure must not look like "already sent"
}

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Notices never include message content: just that something is waiting, with a link.
export async function notifyPeople(personIds: string[], category: Category, subject: string, path: string) {
  const db = adminClient();
  if (!db || !personIds.length) return { delivered: 0, skipped: personIds.length };

  const { data: people } = await db.from("persons").select("id, type, user_id, users(email)").in("id", personIds);
  const { data: prefs } = await db.from("notification_prefs").select("*").in("person_id", personIds);
  const prefOf = Object.fromEntries((prefs ?? []).map((p) => [p.person_id, p]));
  let delivered = 0;

  for (const p of people ?? []) {
    const pref = prefOf[p.id] ?? { email_on: true, sms_on: false, categories: {}, quiet_start: "21:00", quiet_end: "08:00", timezone: "America/Chicago" };
    if (pref.categories?.[category] === false) continue;
    const quiet = inQuietHours(pref.quiet_start.slice(0, 5), pref.quiet_end.slice(0, 5), pref.timezone);
    const link = `${SITE_URL}${path}`;
    const email = (p.users as unknown as { email: string } | null)?.email;

    if (pref.email_on && email && (!quiet || category === "urgent")) {
      const r = await sendEmail(email, subject,
        `<div style="font-family:Arial,sans-serif;max-width:480px;padding:20px;color:#101B2D"><p style="font-size:16px">${esc(subject)}</p>
         <p><a href="${link}" style="background:#F5B700;color:#101B2D;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">Open in ScoutPlatform</a></p>
         <p style="font-size:12px;color:#4B5568">Change what you get in Settings. <a href="${SITE_URL}/settings">Unsubscribe</a>.</p></div>`);
      await db.from("notification_log").insert({ person_id: p.id, channel: "email", category, status: r.status, provider_id: r.id ?? null });
      if (r.status === "sent") delivered++;
    }
    // Texts go to adults who opted in; never to a Scout's own phone.
    if (pref.sms_on && pref.sms_phone && pref.sms_consent_at && p.type === "adult" && (!quiet || category === "urgent")) {
      const r = await sendSms(pref.sms_phone, `${subject} ${link} Reply STOP to opt out.`);
      await db.from("notification_log").insert({ person_id: p.id, channel: "sms", category, status: r.status, provider_id: r.id ?? null });
      if (r.status === "sent") delivered++;
    }
  }
  return { delivered };
}

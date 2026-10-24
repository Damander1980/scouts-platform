import { adminClient, SITE_URL } from "./admin";
import { unsubscribeToken } from "./unsubscribe";

type Category = "messages" | "reminders" | "deadlines" | "payments" | "digest" | "urgent";

// personId adds the one-click unsubscribe header Gmail and Yahoo require of bulk senders.
async function sendEmail(to: string, subject: string, html: string, personId?: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { status: "skipped" as const };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || "Our Troop Manager <notify@ourtroopmanager.com>", to, subject, html,
      ...(personId ? { headers: { "List-Unsubscribe": `<${SITE_URL}/api/unsubscribe?p=${personId}&t=${unsubscribeToken(personId)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}) }),
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

// claimOnce for many keys in two calls instead of two per key; falls back to one at a time if two runs race.
export async function claimMany(db: NonNullable<ReturnType<typeof adminClient>>, keys: string[]) {
  const unique = [...new Set(keys)];
  if (!unique.length) return new Set<string>();
  const { data: seen } = await db.from("notification_log").select("category").eq("channel", "system").in("category", unique);
  const done = new Set((seen ?? []).map((r) => r.category as string));
  const fresh = unique.filter((k) => !done.has(k));
  if (!fresh.length) return new Set<string>();
  const { error } = await db.from("notification_log").insert(fresh.map((category) => ({ category, channel: "system", status: "done" })));
  if (!error) return new Set(fresh);
  if (error.code !== "23505") throw new Error(`Could not record notices: ${error.message}`);
  const won = new Set<string>();
  for (const k of fresh) if (await claimOnce(db, k)) won.add(k);
  return won;
}

// Guardians of a set of people in two queries (person -> households -> guardians), never one query per person:
// Cloudflare caps how many outside calls one request may make.
export async function guardiansOf(db: NonNullable<ReturnType<typeof adminClient>>, personIds: string[]) {
  const out = new Map<string, string[]>();
  const ids = [...new Set(personIds)];
  if (!ids.length) return out;
  const { data: links } = await db.from("household_members").select("household_id, person_id").in("person_id", ids);
  const hhIds = [...new Set((links ?? []).map((l) => l.household_id as string))];
  const { data: gs } = hhIds.length ? await db.from("household_members").select("household_id, person_id").in("household_id", hhIds).eq("is_guardian", true) : { data: [] };
  const byHh = new Map<string, string[]>();
  for (const g of gs ?? []) byHh.set(g.household_id, [...(byHh.get(g.household_id) ?? []), g.person_id]);
  for (const l of links ?? []) out.set(l.person_id, [...new Set([...(out.get(l.person_id) ?? []), ...(byHh.get(l.household_id) ?? [])])]);
  return out;
}

// Addresses on hold (permanent bounce or spam complaint): mailing them again only hurts delivery for everyone.
export async function heldAddresses(db: NonNullable<ReturnType<typeof adminClient>>, emails: (string | null | undefined)[]) {
  const list = [...new Set(emails.filter((e): e is string => !!e).map((e) => e.toLowerCase()))];
  if (!list.length) return new Set<string>();
  const { data } = await db.from("email_suppressions").select("email").in("email", list);
  return new Set((data ?? []).map((r) => r.email as string));
}

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Many notices at once: Resend's batch endpoint takes up to 100 emails per call, which keeps a big reminder
// run well inside Cloudflare's per-run call limit. Returns one result per email, in order.
async function sendEmailBatch(items: { to: string; subject: string; html: string; personId: string }[]) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return items.map(() => ({ status: "skipped" as const, id: undefined as string | undefined }));
  const from = process.env.EMAIL_FROM || "Our Troop Manager <notify@ourtroopmanager.com>";
  const out: { status: "sent" | "failed" | "skipped"; id?: string }[] = [];
  for (let i = 0; i < items.length; i += 100) {
    const chunk = items.slice(i, i + 100);
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(chunk.map((m) => ({ from, to: m.to, subject: m.subject, html: m.html,
        headers: { "List-Unsubscribe": `<${SITE_URL}/api/unsubscribe?p=${m.personId}&t=${unsubscribeToken(m.personId)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }))),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    const ids = (body?.data ?? []) as { id?: string }[];
    chunk.forEach((_, j) => out.push(res?.ok ? { status: "sent", id: ids[j]?.id } : { status: "failed" }));
  }
  return out;
}

export type Notice = { personIds: string[]; category: Category; subject: string; path: string };

// Notices never include message content: just that something is waiting, with a link.
export async function notifyPeople(personIds: string[], category: Category, subject: string, path: string) {
  return notifyMany([{ personIds, category, subject, path }]);
}

// Several different notices in one pass: one lookup of people and preferences, one batched email call per
// 100 emails, one log write. Keeps the daily reminder run small however many families it reaches.
export async function notifyMany(notices: Notice[]) {
  const db = adminClient();
  const allIds = [...new Set(notices.flatMap((n) => n.personIds))];
  if (!db || !allIds.length) return { delivered: 0, skipped: allIds.length };

  const [{ data: people }, { data: prefs }] = await Promise.all([
    db.from("persons").select("id, type, user_id, users(email)").in("id", allIds),
    db.from("notification_prefs").select("*").in("person_id", allIds),
  ]);
  const personOf = Object.fromEntries((people ?? []).map((p) => [p.id, p]));
  const prefOf = Object.fromEntries((prefs ?? []).map((p) => [p.person_id, p]));
  const held = await heldAddresses(db, (people ?? []).map((p) => (p.users as unknown as { email: string } | null)?.email));
  let delivered = 0;
  const emails: { to: string; subject: string; html: string; personId: string; category: string }[] = [];
  const logs: { person_id: string; channel: string; category: string; status: string; provider_id: string | null }[] = [];

  for (const n of notices) {
    const link = `${SITE_URL}${n.path}`;
    for (const id of new Set(n.personIds)) {
      const p = personOf[id];
      if (!p) continue;
      const pref = prefOf[p.id] ?? { email_on: true, sms_on: false, categories: {}, quiet_start: "21:00", quiet_end: "08:00", timezone: "America/Chicago" };
      if (pref.categories?.[n.category] === false) continue;
      const quiet = inQuietHours(pref.quiet_start.slice(0, 5), pref.quiet_end.slice(0, 5), pref.timezone);
      const email = (p.users as unknown as { email: string } | null)?.email;
      if (pref.email_on && email && !held.has(email.toLowerCase()) && (!quiet || n.category === "urgent")) {
        emails.push({ to: email, subject: n.subject, personId: p.id, category: n.category, html:
          `<div style="font-family:Arial,sans-serif;max-width:480px;padding:20px;color:#101B2D"><p style="font-size:16px">${esc(n.subject)}</p>
           <p><a href="${link}" style="background:#F5B700;color:#101B2D;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">Open in Our Troop Manager</a></p>
           <p style="font-size:12px;color:#4B5568">Change what you get in <a href="${SITE_URL}/settings">Settings</a>, or <a href="${SITE_URL}/unsubscribe?p=${p.id}&t=${unsubscribeToken(p.id)}">unsubscribe</a>.</p></div>` });
      }
      // Texts go to adults who opted in; never to a Scout's own phone.
      if (pref.sms_on && pref.sms_phone && pref.sms_consent_at && p.type === "adult" && (!quiet || n.category === "urgent")) {
        const r = await sendSms(pref.sms_phone, `${n.subject} ${link} Reply STOP to opt out.`);
        logs.push({ person_id: p.id, channel: "sms", category: n.category, status: r.status, provider_id: r.id ?? null });
        if (r.status === "sent") delivered++;
      }
    }
  }
  const results = emails.length === 1
    ? [await sendEmail(emails[0].to, emails[0].subject, emails[0].html, emails[0].personId)]
    : await sendEmailBatch(emails);
  results.forEach((r, i) => {
    logs.push({ person_id: emails[i].personId, channel: "email", category: emails[i].category, status: r.status, provider_id: r.id ?? null });
    if (r.status === "sent") delivered++;
  });
  if (logs.length) await db.from("notification_log").insert(logs);
  return { delivered };
}

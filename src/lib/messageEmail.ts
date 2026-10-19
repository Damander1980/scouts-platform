import crypto from "crypto";
import { adminClient, SITE_URL } from "./admin";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// One-click unsubscribe without signing in: a signed token for the person.
export function unsubscribeToken(personId: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "dev";
  return crypto.createHmac("sha256", secret).update(`unsub:${personId}`).digest("hex").slice(0, 32);
}

async function resend(payload: Record<string, unknown>) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { status: "skipped" as const };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.ok ? ("sent" as const) : ("failed" as const), id: body?.id as string | undefined };
}

/**
 * Leaders' messages go out as full emails, like TroopWebHost's TroopMail:
 * "Troop 999 - Sender Name", the message, Reply-all link, recipient list, unsubscribe.
 * Messages from parents/Scouts stay in the app; recipients get a content-free notice.
 * Youth protection: when any youth is involved, Reply-To points back to the app thread
 * (logged and copied) instead of the sender's personal inbox.
 */
export async function deliverMessage(messageId: string) {
  const db = adminClient();
  if (!db) return { delivered: 0, reason: "not configured" };

  const { data: msg } = await db.from("message_log").select("id, org_id, sender_id, subject, body, created_at").eq("id", messageId).single();
  if (!msg) return { delivered: 0, reason: "not found" };
  // Claim the send first so a double click or retry can never email twice.
  const { error: claimErr } = await db.from("message_deliveries").insert({ message_id: messageId });
  if (claimErr) return { delivered: 0, reason: "already delivered" };

  const [{ data: org }, { data: sender }, { data: senderMs }, { data: recips }] = await Promise.all([
    db.from("organizations").select("name, type, unit_number, city, slug, settings").eq("id", msg.org_id).single(),
    db.from("persons").select("id, first_name, last_name, type, email, users(email)").eq("id", msg.sender_id).single(),
    db.from("memberships").select("role, is_admin").eq("org_id", msg.org_id).eq("person_id", msg.sender_id).maybeSingle(),
    db.from("message_recipients").select("person_id, copy_reason, persons(id, first_name, last_name, type, email, users(email))").eq("message_id", messageId),
  ]);
  if (!org || !sender) return { delivered: 0, reason: "missing data" };

  // Service-role client has no signed-in user, so has_perm() can't run here; read positions directly.
  const { data: leaderPos } = await db.from("position_holders").select("unit_positions!inner(permissions)")
    .eq("org_id", msg.org_id).eq("person_id", msg.sender_id).contains("unit_positions.permissions", ["leader"]).limit(1);
  const senderIsLeader = sender.type === "adult" && (!!senderMs?.is_admin || (leaderPos ?? []).length > 0);
  const fullEmail = senderIsLeader && (org.settings as { email_mode?: string } | null)?.email_mode !== "notice";
  type R = { person_id: string; copy_reason: string; persons: { id: string; first_name: string; last_name: string; type: string; email: string | null; users: { email: string } | null } };
  const all = ((recips ?? []) as unknown as R[]).filter((r) => r.copy_reason !== "sender");
  const youthInvolved = sender.type === "youth" || all.some((r) => r.persons.type === "youth");

  const ids = all.map((r) => r.person_id);
  const { data: prefs } = await db.from("notification_prefs").select("person_id, email_on, categories").in("person_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const prefOf = Object.fromEntries((prefs ?? []).map((p) => [p.person_id, p]));

  const word = org.type === "cubs" ? "Pack" : org.type === "venturing" ? "Crew" : org.type === "sea" ? "Ship" : "Troop";
  const unit = `${word} ${org.unit_number ?? ""}`.trim();
  const fromName = `${unit} - ${sender.first_name} ${sender.last_name}`.replace(/["<>]/g, "");
  const fromAddr = process.env.EMAIL_FROM_ADDRESS || "mail@scoutplatform.app";
  const senderEmail = sender.email || (sender.users as unknown as { email: string } | null)?.email || null;
  const link = `${SITE_URL}/messages/${messageId}`;
  const directNames = all.filter((r) => r.copy_reason === "direct").map((r) => `${r.persons.first_name} ${r.persons.last_name}`).sort();

  let delivered = 0, skipped = 0;
  for (const r of all) {
    const p = r.persons;
    if (p.type === "youth") { skipped++; continue; } // youth are reached through their parents' copies
    const to = p.email || p.users?.email;
    const pref = prefOf[r.person_id];
    if (!to || pref?.email_on === false || pref?.categories?.messages === false) { skipped++; continue; }
    const unsub = `${SITE_URL}/unsubscribe?p=${p.id}&t=${unsubscribeToken(p.id)}`;

    const html = fullEmail ? `
<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#14211B;max-width:640px">
  ${r.copy_reason === "parent_copy" ? `<p style="background:#F4F6F5;padding:8px 12px;border-radius:8px;font-size:13px;color:#4D5F57">You're receiving this copy because the message went to your child. Scouting America asks that parents see messages sent to Scouts.</p>` : ""}
  <div style="white-space:pre-wrap">${esc(msg.body)}</div>
  <p style="margin-top:24px">From ${esc(`${sender.first_name} ${sender.last_name}`)}${senderEmail && !youthInvolved ? ` (<a href="mailto:${esc(senderEmail)}">${esc(senderEmail)}</a>)` : ""} at <a href="${SITE_URL}/${org.slug}">${esc(org.name)}</a></p>
  <p><a href="${link}">Click here to REPLY ALL</a></p>
  <p style="margin-top:24px;font-size:13px;color:#4D5F57">This message was sent to:<br>${directNames.map(esc).join("<br>")}</p>
  <p style="font-size:12px;color:#4D5F57"><a href="${unsub}">Unsubscribe</a> from unit email.</p>
</div>` : `
<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#14211B;max-width:520px">
  <p>${esc(`${sender.first_name} ${sender.last_name}`)} sent you a message in ${esc(org.name)}.</p>
  <p><a href="${link}" style="background:#FF6A1A;color:#14211B;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">Read it</a></p>
  <p style="font-size:12px;color:#4D5F57"><a href="${unsub}">Unsubscribe</a></p>
</div>`;

    const res = await resend({
      from: `${fromName} <${fromAddr}>`,
      to,
      subject: fullEmail ? (msg.subject || `Message from ${unit}`) : `New message in ${org.name}`,
      html,
      ...(fullEmail && senderEmail && !youthInvolved ? { reply_to: senderEmail } : {}),
      headers: { "List-Unsubscribe": `<${SITE_URL}/api/unsubscribe?p=${p.id}&t=${unsubscribeToken(p.id)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    });
    await db.from("notification_log").insert({ person_id: p.id, channel: "email", category: "messages", status: res.status, provider_id: res.id ?? null });
    if (res.status === "sent") delivered++;
  }

  await db.from("message_deliveries").update({ delivered, skipped, full_email: fullEmail }).eq("message_id", messageId);
  return { delivered, skipped, full: fullEmail };
}

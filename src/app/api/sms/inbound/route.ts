import crypto from "node:crypto";
import { adminClient, SITE_URL } from "@/lib/admin";

// Twilio inbound-text webhook: STOP/HELP/START replies (SPEC "Notifications and text messaging").
// Point the Twilio number's "A message comes in" webhook at {SITE_URL}/api/sms/inbound.
// Twilio's own Advanced Opt-Out also blocks the number on STOP; this keeps our records in step
// so the app stops trying and the opt-out is logged.

const STOP = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "REVOKE", "OPTOUT"];
const START = ["START", "UNSTOP", "YES"];
const HELP = ["HELP", "INFO"];

const twiml = (text?: string) => new Response(
  `<?xml version="1.0" encoding="UTF-8"?><Response>${text ? `<Message>${text.replace(/[<>&]/g, "")}</Message>` : ""}</Response>`,
  { headers: { "Content-Type": "text/xml" } });

// https://www.twilio.com/docs/usage/security#validating-requests
function validSignature(url: string, params: Record<string, string>, signature: string, token: string) {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = crypto.createHmac("sha1", token).update(data).digest("base64");
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const last10 = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "").slice(-10);

export async function POST(request: Request) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  const db = adminClient();
  if (!token || !db) return new Response("not configured", { status: 503 });

  const params = Object.fromEntries(new URLSearchParams(await request.text())) as Record<string, string>;
  const url = `${SITE_URL.replace(/\/$/, "")}/api/sms/inbound`;
  if (!validSignature(url, params, request.headers.get("x-twilio-signature") ?? "", token)) {
    return new Response("bad signature", { status: 403 });
  }

  const word = (params.Body ?? "").trim().toUpperCase().split(/\s+/)[0] ?? "";
  const from = last10(params.From);
  if (from.length < 10) return twiml();

  // Phones are stored as typed, so match on the last ten digits. Narrowed by the last four in the query:
  // PostgREST returns at most 1000 rows, so reading every saved phone would miss STOPs once there are more.
  const { data: prefs } = await db.from("notification_prefs").select("person_id, sms_on, sms_phone, sms_consent_at").like("sms_phone", `%${from.slice(-4)}%`);
  const matches = (prefs ?? []).filter((p) => last10(p.sms_phone) === from);

  if (STOP.includes(word)) {
    for (const m of matches) {
      await db.from("notification_prefs").update({ sms_on: false, sms_consent_at: null, updated_at: new Date().toISOString() }).eq("person_id", m.person_id);
      await db.from("notification_log").insert({ person_id: m.person_id, channel: "sms", category: "opt_out", status: "received", provider_id: params.MessageSid ?? null });
    }
    return twiml(); // Twilio sends the carrier-required STOP confirmation itself.
  }

  if (START.includes(word)) {
    // Texting START unblocks the number at Twilio, but we only resume after consent is given
    // again in the app, so the recorded opt-in stays accurate.
    return twiml(`To get texts again, turn them on in Settings: ${SITE_URL}/settings`);
  }

  if (HELP.includes(word)) {
    return twiml(`Unit notices from Our Troop Manager. Msg frequency varies. Msg & data rates may apply. Manage texts at ${SITE_URL}/settings. Reply STOP to opt out.`);
  }

  // Replies are not read here: messages live in the app, not in texts.
  return twiml(`This number does not take replies. Read and answer messages in the app: ${SITE_URL}/messages. Reply STOP to opt out.`);
}

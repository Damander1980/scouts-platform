import crypto from "crypto";

// Per-person unsubscribe token for email links and the RFC 8058 one-click header.
export function unsubscribeToken(personId: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "dev";
  return crypto.createHmac("sha256", secret).update(`unsub:${personId}`).digest("hex").slice(0, 32);
}

export function validUnsubscribe(personId: string | null | undefined, token: string | null | undefined) {
  if (!personId || !token) return false;
  const a = Buffer.from(token), b = Buffer.from(unsubscribeToken(personId));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

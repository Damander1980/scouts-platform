import { createClient as createSupabase } from "@supabase/supabase-js";

// Server-only client that bypasses row-level security. Used only for fan-out jobs
// (notification delivery, webhooks) after the caller's own permissions were checked.
export function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } });
}

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

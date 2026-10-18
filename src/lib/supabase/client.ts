import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Emailed sign-in links must work when opened in a different browser or device than
// the one that requested them (e.g. a phone mail app). The default PKCE flow ties the
// link to the requesting browser, so email sign-in uses the implicit flow instead.
export function createEmailLinkClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: "implicit" } }
  );
}

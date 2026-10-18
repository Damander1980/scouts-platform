import { adminClient } from "@/lib/admin";
import { unsubscribeToken } from "@/lib/messageEmail";

export default async function Unsubscribe({ searchParams }: { searchParams: Promise<{ p?: string; t?: string }> }) {
  const { p, t } = await searchParams;
  const db = adminClient();
  let ok = false;
  if (db && p && t && t === unsubscribeToken(p)) {
    const { error } = await db.from("notification_prefs").upsert({ person_id: p, email_on: false, updated_at: new Date().toISOString() });
    ok = !error;
    if (ok) await db.from("notification_log").insert({ person_id: p, channel: "email", category: "unsubscribe", status: "opted_out" });
  }
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6">
      <div className="card max-w-md text-center flex flex-col gap-3 py-8">
        <div className="font-display font-bold text-[22px]">{ok ? "You're unsubscribed" : "That link didn't work"}</div>
        <p className="text-smoke m-0">{ok ? "You won't get unit email anymore. You can turn it back on any time in Settings." : "Sign in and change your email choices in Settings."}</p>
        <a href="/settings" className="btn-secondary no-underline">Open Settings</a>
      </div>
    </div>
  );
}

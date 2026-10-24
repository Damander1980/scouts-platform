import { adminClient } from "@/lib/admin";
import { validUnsubscribe } from "@/lib/unsubscribe";
import { redirect } from "next/navigation";

// Opening the link only asks. Mail scanners (Outlook Safe Links, Gmail) open every link in an email,
// so unsubscribing on page load silently turned off parents' unit email, including copies of
// messages to their Scouts. The change happens on the button press.
async function confirmUnsubscribe(form: FormData) {
  "use server";
  const p = String(form.get("p") ?? ""), t = String(form.get("t") ?? "");
  const db = adminClient();
  let ok = false;
  if (db && validUnsubscribe(p, t)) {
    const { error } = await db.from("notification_prefs").upsert({ person_id: p, email_on: false, updated_at: new Date().toISOString() });
    ok = !error;
    if (ok) await db.from("notification_log").insert({ person_id: p, channel: "email", category: "unsubscribe", status: "opted_out" });
  }
  redirect(`/unsubscribe?done=${ok ? "1" : "0"}`);
}

export default async function Unsubscribe({ searchParams }: { searchParams: Promise<{ p?: string; t?: string; done?: string }> }) {
  const { p, t, done } = await searchParams;
  const valid = validUnsubscribe(p, t);
  const [title, body] = done === "1"
    ? ["You're unsubscribed", "You won't get unit email anymore. You can turn it back on any time in Settings."]
    : done === "0" || !valid
      ? ["That link didn't work", "Sign in and change your email choices in Settings."]
      : ["Stop unit email?", "You'll stop getting email from your unit, including copies of messages sent to your Scouts. Messages still show in the app."];
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
      <div className="card max-w-md text-center flex flex-col gap-3 py-8">
        <div className="font-display font-bold text-[22px]">{title}</div>
        <p className="text-smoke m-0">{body}</p>
        {!done && valid && (
          <form action={confirmUnsubscribe} className="flex flex-col gap-2">
            <input type="hidden" name="p" value={p} />
            <input type="hidden" name="t" value={t} />
            <button type="submit" className="btn-primary">Unsubscribe</button>
          </form>
        )}
        <a href="/settings" className="btn-secondary no-underline">Open Settings</a>
      </div>
    </div>
  );
}

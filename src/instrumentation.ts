// Runs once when the server starts. Hosting servers run on UTC, which would show a 7 PM Thursday
// meeting as "12:00 AM Friday". Node honors changes to TZ at runtime, so every server-rendered
// date uses the unit's zone (Central for the pilot; set NEXT_PUBLIC_TIME_ZONE to change it).
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") process.env.TZ = process.env.NEXT_PUBLIC_TIME_ZONE || "America/Chicago";
}

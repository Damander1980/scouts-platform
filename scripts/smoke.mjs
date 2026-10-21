// Loads every public page and reports anything that isn't a success. Pages behind sign-in should
// redirect to /login (that counts as OK). Usage: node scripts/smoke.mjs [base-url]
const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const pages = ["/", "/login", "/safety", "/help", "/changes", "/demo/tour", "/demo", "/demo/scout", "/demo/admin", "/demo/advancement",
  "/demo/calendar", "/demo/trip-sheet", "/demo/forum", "/demo/recharter", "/manifest.webmanifest"];
const gated = ["/dashboard", "/events", "/admin", "/pay", "/forms", "/patrols", "/plc", "/settings"];
let bad = 0;
for (const p of pages) {
  const r = await fetch(base + p, { redirect: "manual" });
  const ok = r.status < 400;
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${r.status} ${p}`);
}
for (const p of gated) {
  const r = await fetch(base + p, { redirect: "manual" });
  const ok = r.status >= 300 && r.status < 400 && (r.headers.get("location") ?? "").includes("/login");
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${r.status} ${p} (should send signed-out visitors to sign in)`);
}
console.log(bad ? `\n${bad} problem(s)` : "\nAll good");
process.exit(bad ? 1 : 0);

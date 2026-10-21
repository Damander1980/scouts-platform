// Sets a password for an existing account. You type the password; it is not stored or printed.
// Usage: node scripts/set-password.mjs you@example.com
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const email = process.argv[2];
if (!email) { console.error("Usage: node scripts/set-password.mjs you@example.com"); process.exit(1); }

const rl = createInterface({ input: process.stdin, output: process.stdout });
rl._writeToOutput = (s) => { if (s.includes("New password")) process.stdout.write(s); };
rl.question("New password (hidden): ", async (password) => {
  rl.close(); process.stdout.write("\n");
  if (password.length < 8) { console.error("Use at least 8 characters."); process.exit(1); }
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (error) { console.error(error.message); process.exit(1); }
  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) { console.error(`No account for ${email}.`); process.exit(1); }
  const { error: e2 } = await db.auth.admin.updateUserById(user.id, { password });
  if (e2) { console.error(e2.message); process.exit(1); }
  console.log(`Password set for ${email}. Sign in at http://localhost:3000/login`);
});

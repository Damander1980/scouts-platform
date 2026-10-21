// Creates a sample troop ("Troop 999 Test, Plano") with fake families, patrols, events, sign-ups,
// health form status and balances, and makes the given account its Scoutmaster and admin.
// All names are made up. Run it yourself:
//   node scripts/seed-demo.mjs you@example.com           create the sample troop
//   node scripts/seed-demo.mjs you@example.com --remove  delete it and the fake people again
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const [email, flag] = process.argv.slice(2);
if (!email) { console.error("Usage: node scripts/seed-demo.mjs you@example.com [--remove]"); process.exit(1); }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const SLUG = "troop999testplano";
const die = (msg) => { console.error(msg); process.exit(1); };
const must = ({ data, error }, what) => { if (error) die(`${what}: ${error.message}`); return data; };

const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
const user = users.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) die(`No account for ${email}. Sign up at /login first.`);

const { data: existing } = await db.from("organizations").select("id").eq("slug", SLUG).maybeSingle();

if (flag === "--remove") {
  if (!existing) die("No sample troop to remove.");
  const people = must(await db.from("memberships").select("person_id").eq("org_id", existing.id), "members").map((m) => m.person_id);
  must(await db.from("organizations").delete().eq("id", existing.id), "delete troop");
  for (const id of people) {
    const { data: p } = await db.from("persons").select("user_id").eq("id", id).single();
    const { count } = await db.from("memberships").select("*", { count: "exact", head: true }).eq("person_id", id);
    if (p && !p.user_id && !count) await db.from("persons").delete().eq("id", id);
  }
  console.log("Sample troop removed.");
  process.exit(0);
}
if (existing) die("The sample troop already exists. Remove it first with --remove.");

// You
let { data: me } = await db.from("persons").select("id, first_name").eq("user_id", user.id).maybeSingle();
if (!me) {
  const first = (user.user_metadata?.full_name ?? email.split("@")[0]).split(" ")[0];
  me = must(await db.from("persons").insert({ user_id: user.id, first_name: first, last_name: "", type: "adult", email }).select("id, first_name").single(), "you");
}

const org = must(await db.from("organizations").insert({
  name: "Troop 999 Test", type: "scouts_bsa", unit_number: "999", city: "Plano", state: "TX", slug: SLUG,
  join_code: Math.random().toString(36).slice(2, 8), settings: { payment_methods: "both", card_fee_payer: "family" },
}).select("id").single(), "troop");
const O = org.id;
const yearOut = (m) => new Date(Date.now() + m * 30 * 86400000).toISOString().slice(0, 10);
const day = (d, h = 19) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, 0, 0, 0); return x.toISOString(); };

must(await db.from("memberships").insert({ org_id: O, person_id: me.id, role: "scoutmaster", is_admin: true, is_designated_leader: true, ypt_expires: yearOut(18) }), "your membership");

// Families: [last name, parent first, parent role, [scouts as [first, age, patrol]]]
const FAMILIES = [
  ["Garcia", "Tom", "parent_guardian", [["Jake", 14, "Eagles"], ["Maya", 12, "Hawks"]]],
  ["Chen", "Lisa", "committee_chair", [["Emma", 15, "Eagles"]]],
  ["Brooks", "Dana", "assistant_scoutmaster", [["Ethan", 13, "Eagles"]]],
  ["Shah", "Raj", "treasurer", [["Priya", 12, "Hawks"]]],
  ["Okafor", "Grace", "parent_guardian", [["Daniel", 11, "Hawks"], ["Samuel", 14, "Eagles"]]],
  ["Mitchell", "Sarah", "assistant_scoutmaster", [["Noah", 16, "Eagles"]]],
  ["Nguyen", "Kim", "parent_guardian", [["Leo", 11, "Hawks"]]],
];
const patrols = Object.fromEntries(await Promise.all(["Eagles", "Hawks"].map(async (n) =>
  [n, must(await db.from("patrols").insert({ org_id: O, name: n }).select("id").single(), "patrol").id])));

const scouts = [], adults = [];
for (const [last, parent, role, kids] of FAMILIES) {
  const hh = must(await db.from("households").insert({ org_id: O, name: `${last} family` }).select("id").single(), "household");
  const p = must(await db.from("persons").insert({ first_name: parent, last_name: last, type: "adult" }).select("id").single(), "parent");
  const leader = role !== "parent_guardian";
  must(await db.from("memberships").insert({ org_id: O, person_id: p.id, role, is_designated_leader: role === "assistant_scoutmaster",
    ypt_expires: leader ? (last === "Mitchell" ? yearOut(-2) : yearOut(14)) : null }), "parent membership");
  must(await db.from("household_members").insert({ household_id: hh.id, person_id: p.id, relation: "parent", is_guardian: true }), "parent link");
  adults.push({ id: p.id, hh: hh.id, leader });
  for (const [first, age, patrol] of kids) {
    const born = new Date(); born.setFullYear(born.getFullYear() - age); born.setMonth(Math.floor(Math.random() * 12));
    const k = must(await db.from("persons").insert({ first_name: first, last_name: last, type: "youth", birthdate: born.toISOString().slice(0, 10) }).select("id").single(), "scout");
    must(await db.from("memberships").insert({ org_id: O, person_id: k.id, role: "scout" }), "scout membership");
    must(await db.from("household_members").insert({ household_id: hh.id, person_id: k.id, relation: "scout", is_guardian: false }), "scout link");
    must(await db.from("patrol_members").insert({ org_id: O, patrol_id: patrols[patrol], person_id: k.id, role: first === "Emma" || first === "Priya" ? "patrol_leader" : "member" }), "patrol member");
    scouts.push({ id: k.id, hh: hh.id, first });
  }
}

// Events
const ev = async (e) => must(await db.from("events").insert({ org_id: O, created_by: me.id, ...e }).select("id").single(), e.title).id;
const meeting = await ev({ title: "Troop meeting", kind: "meeting", location: "Grace Presbyterian, Fellowship Hall", start_at: day(1), end_at: day(1, 20) });
const campout = await ev({ title: "Caprock Canyons campout", kind: "campout", location: "Caprock Canyons State Park", start_at: day(9, 17), end_at: day(11, 12),
  cost_cents: 4500, cap: 30, rsvp_deadline: day(6, 21), refund_rule: "partial", needs_permission: true, overnight_nights: 2, miles: 6,
  description: "Two nights at Caprock. We leave the church parking lot Friday at 5 PM. Bring your Class A for Saturday's flag ceremony." });
await ev({ title: "Food bank service project", kind: "service", location: "North Texas Food Bank, Plano", start_at: day(16, 9), end_at: day(16, 12), service_hours: 3 });
await ev({ title: "Court of Honor", kind: "event", location: "Fellowship Hall", start_at: day(30), end_at: day(30, 20) });
const past = await ev({ title: "Day hike at Arbor Hills", kind: "event", location: "Arbor Hills Nature Preserve", start_at: day(-12, 9), end_at: day(-12, 13), miles: 5 });
void meeting;

// Campout sign-ups and charges: most going, a few haven't answered, one not going.
for (const [i, s] of scouts.entries()) {
  if (i === scouts.length - 1) continue; // no reply
  const going = i !== 2;
  must(await db.from("rsvps").insert({ event_id: campout, person_id: s.id, status: going ? "going" : "not_going" }), "rsvp");
  if (going) must(await db.from("ledger_entries").insert({ org_id: O, household_id: s.hh, person_id: s.id, event_id: campout, amount_cents: 4500, type: "charge", description: "Caprock Canyons campout" }), "charge");
}
for (const a of adults.filter((x) => x.leader).slice(0, 3)) must(await db.from("rsvps").insert({ event_id: campout, person_id: a.id, status: "going", driver_seats: 3 }), "adult rsvp");
// Some families already paid in person.
for (const s of scouts.slice(0, 4)) must(await db.from("ledger_entries").insert({ org_id: O, household_id: s.hh, amount_cents: -4500, type: "payment", method: "check", manual: true, description: "Check, Caprock campout" }), "payment");

// Past hike attendance (feeds hiking miles)
for (const s of scouts.slice(0, 6)) must(await db.from("attendance").insert({ org_id: O, event_id: past, person_id: s.id, present: true }), "attendance");

// Health form status (status only, never the form): most on file, two missing, one expiring soon.
for (const [i, s] of scouts.entries()) {
  if (i === 1 || i === 5) continue;
  must(await db.from("forms").insert({ org_id: O, person_id: s.id, type: "health_ab", status: "received", expires_at: i === 3 ? yearOut(1) : yearOut(9), marked_by: me.id }), "form");
}

console.log(`Sample troop created with ${scouts.length} Scouts and ${adults.length + 1} adults.`);
console.log("Sign in, then switch to \"Troop 999 Test\" from the unit button in the top bar.");
console.log("Remove it any time: node scripts/seed-demo.mjs " + email + " --remove");

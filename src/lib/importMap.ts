// Turns rows from a roster or advancement CSV (our template, Scoutbook Plus exports, common
// spreadsheets) into the shape the import functions expect. Kept free of React so it can be tested.

// Header aliases cover our template, Scoutbook Plus exports and common spreadsheets.
export const ROSTER_FIELDS: Record<string, string[]> = {
  first: ["first", "first name", "firstname", "given name", "scout first name"],
  last: ["last", "last name", "lastname", "surname", "family name", "scout last name"],
  type: ["type", "youth/adult", "member type", "youth or adult", "adult/youth", "member type (youth/adult)"],
  birthdate: ["birthdate", "birth date", "dob", "date of birth", "birthday"],
  role: ["role", "position", "leader position", "unit position", "positions"],
  patrol: ["patrol", "patrol name", "den", "sub unit", "subunit", "sub-unit", "sub unit name"],
  household: ["household", "family", "family id"],
  email: ["email", "e-mail", "email address", "parent email", "parent 1 email", "primary email"],
  member_id: ["member id", "bsa member id", "memberid", "bsa id", "member #", "member number"],
  ypt_expires: ["ypt expires", "ypt expiration", "ypt expiration date", "ypt exp", "youth protection expires",
    "youth protection expiration", "youth protection expiration date", "y01 expires", "safeguarding youth expires"],
};
export const ADV_FIELDS: Record<string, string[]> = {
  first: ["first name", "first", "firstname"],
  last: ["last name", "last", "lastname"],
  type: ["advancement type", "type"],
  item: ["advancement", "award", "rank", "merit badge", "item"],
  date: ["date completed", "date earned", "completed", "date", "awarded date"],
};

export const ROLE_MAP: Record<string, string> = {
  scoutmaster: "scoutmaster", "assistant scoutmaster": "assistant_scoutmaster", asm: "assistant_scoutmaster",
  "committee chair": "committee_chair", "committee member": "committee_member", treasurer: "treasurer",
  "advancement chair": "advancement_chair", "chartered org rep": "chartered_org_rep", "chartered organization representative": "chartered_org_rep",
  "merit badge counselor": "merit_badge_counselor", parent: "parent_guardian", "parent/guardian": "parent_guardian",
  cubmaster: "cubmaster", "den leader": "den_leader", scout: "scout", youth: "scout",
  // Scoutbook Plus position names
  "youth member": "scout", "unit advancement chair": "advancement_chair", "key 3 delegate": "committee_member",
  "unit leader": "scoutmaster", "unit committee chair": "committee_chair", "assistant scoutmaster (asm)": "assistant_scoutmaster",
};

export function mapRow(row: Record<string, string>, fields: Record<string, string[]>): Record<string, string> {
  const lower = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase().trim(), v]));
  return Object.fromEntries(Object.entries(fields).map(([f, aliases]) => [f, aliases.map((a) => lower[a]).find((v) => v !== undefined && v !== "") ?? ""]));
}

export function toIsoDate(s: string) {
  if (!s) return "";
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`; }
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}


type Row = Record<string, string>;

// Some exports have a single "Name" column ("Last, First" or "First Last").
function splitName(raw: Row, m: Row) {
  if (m.first || m.last) return;
  const full = Object.entries(raw).find(([k]) => ["name", "full name", "member name", "scout name"].includes(k.toLowerCase().trim()))?.[1]?.trim() ?? "";
  if (full.includes(",")) { const [l, f] = full.split(","); m.last = l.trim(); m.first = (f ?? "").trim(); }
  else if (full) { const parts = full.split(/\s+/); m.first = parts[0]; m.last = parts.slice(1).join(" "); }
}

export function mapRoster(parsed: Row[]): Row[] {
  return parsed.map((raw): Row => {
    const r: Row = mapRow(raw, ROSTER_FIELDS);
    splitName(raw, r);
    const role = ROLE_MAP[r.role?.toLowerCase()] ?? "";
    // Scoutbook writes YOUTH / ADULT; anything else falls back to the role.
    const type = /^y/i.test(r.type) ? "youth" : /^a/i.test(r.type) ? "adult" : role && role !== "scout" ? "adult" : "youth";
    return { ...r, household: r.household || r.email, birthdate: toIsoDate(r.birthdate), ypt_expires: toIsoDate(r.ypt_expires), role, type };
  }).filter((r) => r.first && r.last);
}

export function parseAdvancement(item: string, type: string) {
  // Scoutbook lists requirements as e.g. "Tenderfoot #4a" or "Camping #9a".
  const m = item.match(/^(.*?)\s*#\s*([0-9]+[a-z]?)/i);
  if (m) return { item: m[1].trim(), requirement: m[2] };
  if (/requirement/i.test(type)) return { item, requirement: "" };
  return { item: item.replace(/\s*merit badge$/i, "").trim(), requirement: "" };
}

export function mapAdvancement(parsed: Row[]): Row[] {
  return parsed.map((raw): Row => {
    const r: Row = mapRow(raw, ADV_FIELDS);
    splitName(raw, r);
    return { ...r, date: toIsoDate(r.date), ...parseAdvancement(r.item, r.type) };
  }).filter((r) => r.first && r.last);
}

// Scoutbook activity log export (camping nights, hiking miles, service hours). Exports either have one
// amount column with a type column, or separate Nights / Miles / Hours columns.
export const ACTIVITY_FIELDS: Record<string, string[]> = {
  first: ["first name", "first", "firstname"],
  last: ["last name", "last", "lastname"],
  kind: ["log type", "activity type", "type", "category"],
  amount: ["amount", "quantity", "total"],
  nights: ["nights", "nights camped", "camping nights", "days and nights"],
  miles: ["miles", "hiking miles"],
  hours: ["hours", "service hours"],
  date: ["date", "activity date", "start date", "date completed"],
  note: ["location", "notes", "description", "name", "activity name"],
};

export function mapActivity(parsed: Row[]): Row[] {
  return parsed.map((raw): Row => {
    const r: Row = mapRow(raw, ACTIVITY_FIELDS);
    splitName(raw, r);
    let kind = r.kind.toLowerCase();
    let amount = r.amount;
    if (!amount) {
      if (r.nights) { amount = r.nights; kind = kind || "camping"; }
      else if (r.miles) { amount = r.miles; kind = kind || "hiking"; }
      else if (r.hours) { amount = r.hours; kind = kind || "service"; }
    }
    kind = /camp|night/.test(kind) ? "camping" : /hik|mile/.test(kind) ? "hiking" : /serv|hour/.test(kind) ? "service" : "";
    return { first: r.first, last: r.last, kind, amount: (amount || "").replace(/[^0-9.]/g, ""), date: toIsoDate(r.date), note: r.note };
  }).filter((r) => r.first && r.last && r.kind && r.amount);
}

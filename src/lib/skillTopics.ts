// Starter skill modules: every Trail to First Class requirement sorted into a teachable topic by its wording.
// First match wins, so order matters. Leaders can rename, regroup or delete any of them afterward.
const TOPICS: [string, RegExp][] = [
  ["Personal safety", /youth protection|personal safety|three rs|bully|abuse|drugs|alcohol|tobacco/i],
  ["Service", /\bservice\b/i],
  ["Scout basics: Oath, Law and ranks", /oath|scout law|motto|slogan|scout spirit|sign, salute|handshake|advancement|scouts bsa ranks|merit badges|first class badge/i],
  ["Patrol and troop", /patrol method|patrol types|patrol name|troop meeting|how scouts lead|board of review|scoutmaster conference|eating together|eligible|invite/i],
  ["Knots and lashings", /\bknots?\b|hitch|lashing|whip|fuse the ends|sheet bend|bowline/i],
  ["Emergency preparedness", /emergenc|utilities|drinking water|vehicle accident/i],
  ["Cooking and meals", /\bcook|\bmeal|menu|food|stove|pans|utensils|eating gear|shopping list/i],
  ["Fire building", /\bfires?\b|tinder|kindling/i],
  ["Woods tools", /pocketknife|\bknife\b|\bax\b|\baxe\b|woods tools/i],
  ["First aid", /first aid|injur|bleed|bites|stings|blister|bandage|hurry|heart attack|\bcpr\b|smoky room|carry (a|the|someone)/i],
  ["Navigation: map and compass", /\bmap\b|compass|\bgps\b|orienteering|directions? day and night/i],
  ["Hiking safety", /buddy system|\bhik|get lost|durable surfaces/i],
  ["Swimming and boating", /swim|rescue|afloat|canoe|kayak|\bboat|paddle/i],
  ["Camping and Leave No Trace", /camp|\btent|overnight|outdoor code|leave no trace|weather|troop\/patrol activities/i],
  ["Nature and environment", /plant|animal|wildlife|environmental|trash|recycle/i],
  ["Fitness", /push-?ups|sit-?ups|sit-and-reach|be active|stay active|improvement plan|retest/i],
  ["Money skills", /budget|savings|earning plan|price/i],
  ["Citizenship and the flag", /flag|citizen|government|official|pledge of allegiance/i],
];

export function topicOf(text: string) {
  for (const [name, re] of TOPICS) if (re.test(text)) return name;
  return "Other skills";
}

/** Group requirement ids into starter modules, in teaching order. */
export function starterModules(reqs: { id: string; text: string }[]) {
  const order = [...TOPICS.map(([n]) => n), "Other skills"];
  const by = new Map<string, string[]>();
  for (const r of reqs) { const t = topicOf(r.text); by.set(t, [...(by.get(t) ?? []), r.id]); }
  return order.filter((t) => by.has(t)).map((title, i) => ({ title, requirement_ids: by.get(title) ?? [], sort: i }));
}

/** A YouTube search for a requirement, so a Scout can find a how-to video without us guessing a link. */
export function videoSearch(text: string) {
  const words = text.replace(/\(.*?\)/g, "").replace(/[^\w\s-]/g, " ").split(/\s+/).filter(Boolean).slice(0, 12).join(" ");
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`Scouts BSA ${words}`)}`;
}

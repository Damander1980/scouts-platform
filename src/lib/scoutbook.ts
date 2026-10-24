// Server-only client for Scouting America's unofficial JSON API (what Scoutbook Plus itself calls).
// Endpoints come from the community-documented spec at github.com/mmarseglia/scouting-api (Apache-2.0).
// Not an official integration: Scouting America can change it without notice, so every call fails
// soft and callers show "couldn't reach Scoutbook" instead of breaking. Never log or return tokens.

const AUTH = "https://my.scouting.org/api/users";
const API = "https://api.scouting.org";
const HEADERS = { Accept: "application/json; version=2", "User-Agent": "OurTroopManager/1.0 (unit management; Scoutbook sync)" };

export type Session = { token: string; userId: string };
export class ScoutbookError extends Error {
  constructor(message: string, readonly status?: number) { super(message); }
}

type Fetch = typeof fetch;

/** Signs in with a leader's my.scouting.org login. Returns a short-lived token and their Scoutbook user id. */
export async function signIn(username: string, password: string, f: Fetch = fetch): Promise<Session> {
  const res = await f(`${AUTH}/${encodeURIComponent(username)}/authenticate`, {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ password }).toString(),
  });
  if (res.status === 401 || res.status === 403) throw new ScoutbookError("Scoutbook didn't accept that username and password.", res.status);
  if (!res.ok) throw new ScoutbookError(`Scoutbook sign-in failed (${res.status}).`, res.status);
  const body = (await res.json().catch(() => null)) as { token?: string; account?: { userId?: string | number } } | null;
  const token = body?.token, userId = body?.account?.userId;
  if (!token || userId === undefined || userId === null || String(userId) === "") throw new ScoutbookError("Scoutbook's sign-in response wasn't what we expected.");
  return { token, userId: String(userId) };
}

async function get<T>(s: Session, path: string, f: Fetch = fetch): Promise<T> {
  const res = await f(`${API}${path}`, { headers: { ...HEADERS, Authorization: `Bearer ${s.token}` } });
  if (res.status === 401) throw new ScoutbookError("Scoutbook session expired or not allowed.", 401);
  if (!res.ok) throw new ScoutbookError(`Scoutbook request failed (${res.status}).`, res.status);
  return (await res.json()) as T;
}

export type RankInfo = { id: string; name: string; programId?: string; version?: string; level?: string; active?: string };
export type RankRequirement = { id: string; name?: string; short?: string; requirementNumber?: string; listNumber?: string; parentRequirementId?: string; sortOrder?: string };

/** All active Scouts BSA ranks (programId 2), as Scoutbook lists them. */
export async function ranks(s: Session, f: Fetch = fetch): Promise<RankInfo[]> {
  const body = await get<{ ranks?: RankInfo[] } | RankInfo[]>(s, "/advancements/ranks?programId=2&status=active", f);
  return Array.isArray(body) ? body : body.ranks ?? [];
}

/** Official requirements for one rank id. */
export async function rankRequirements(s: Session, rankId: string, f: Fetch = fetch): Promise<RankRequirement[]> {
  const body = await get<{ requirements?: RankRequirement[] }>(s, `/advancements/ranks/${encodeURIComponent(rankId)}/requirements`, f);
  return body.requirements ?? [];
}

/** A Scout's leadership position history (includes bsaMemberId, which matches our member ids). */
export async function leadershipHistory(s: Session, scoutbookUserId: string, f: Fetch = fetch) {
  return get<{ position: string; startDate: string; endDate: string | null; bsaMemberId?: string; numberOfDaysInPosition?: string; patrol?: string }[]>(
    s, `/advancements/youth/${encodeURIComponent(scoutbookUserId)}/leadershipPositionHistory`, f);
}

/** Normalizes a requirement number for comparison: "1a", "1 a", "1(a)" all become "1a". */
export function reqKey(n: string | undefined | null) {
  return String(n ?? "").toLowerCase().replace(/[^0-9a-z]/g, "");
}

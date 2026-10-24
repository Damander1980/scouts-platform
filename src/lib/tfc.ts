import type { Item, Progress } from "@/components/AdvancementClient";

// Trail to First Class: Scout, Tenderfoot, Second Class and First Class, usually worked on together in a
// Scout's first year. Requirements can be done in any order across the four ranks.
export const TFC_RANKS = ["scout", "tenderfoot", "second_class", "first_class"] as const;

export type TfcReq = { id: string; number: string; text: string; rank: string; rankName: string };
export type TfcRank = { code: string; name: string; done: number; waiting: number; total: number; earned: boolean };
export type Tfc = { ranks: TfcRank[]; next: TfcReq[]; waiting: TfcReq[]; done: number; total: number; finished: boolean; all: TfcReq[] };

// "2. Do the following:" is only a heading when 2a, 2b... exist; it isn't a task on its own.
function tasks(item: Item) {
  const nums = item.requirements.map((r) => r.number.toLowerCase());
  return [...item.requirements].sort((a, b) => a.sort - b.sort)
    .filter((r) => !nums.some((n) => n !== r.number.toLowerCase() && n.startsWith(r.number.toLowerCase()) && /^[a-z]/.test(n.slice(r.number.length))));
}

/** earned: rank codes already awarded (their requirements all count as done). */
export function trailToFirstClass(items: Item[], progress: Progress, earned: Set<string>, nextCount = 6): Tfc {
  const ranks: TfcRank[] = [];
  const next: TfcReq[] = [], waiting: TfcReq[] = [], all: TfcReq[] = [];
  for (const code of TFC_RANKS) {
    const item = items.find((i) => i.kind === "rank" && i.program === "scouts_bsa" && i.code === code);
    if (!item) continue;
    const list = tasks(item);
    const isEarned = earned.has(code);
    let done = 0, wait = 0;
    for (const r of list) {
      const req = { id: r.id, number: r.number, text: r.text, rank: code, rankName: item.name };
      all.push(req);
      const p = progress[r.id];
      if (isEarned || p?.approved_by) done++;
      else if (p?.completed_at) { wait++; waiting.push(req); }
      else if (next.length < nextCount) next.push(req);
    }
    ranks.push({ code, name: item.name, done, waiting: wait, total: list.length, earned: isEarned });
  }
  const done = ranks.reduce((s, r) => s + r.done, 0), total = ranks.reduce((s, r) => s + r.total, 0);
  return { ranks, next, waiting, done, total, finished: ranks.length > 0 && ranks.every((r) => r.earned), all };
}

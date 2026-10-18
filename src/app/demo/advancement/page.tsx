import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AdvancementClient, { type Item, type Progress, type Tracked } from "@/components/AdvancementClient";
import { loadCatalog } from "@/lib/advancement";

// Fake progress: [code, how many requirements signed off, how many more done-but-unsigned, status]
const DEMO: [string, number, number, Tracked["status"]][] = [
  ["scout", 99, 0, "completed"],
  ["tenderfoot", 99, 0, "completed"],
  ["second_class", 7, 2, "in_progress"],
  ["camping", 5, 1, "in_progress"],
  ["first_aid", 99, 0, "completed"],
  ["hiking", 2, 1, "in_progress"],
  ["cooking", 3, 1, "in_progress"],
  ["swimming", 99, 0, "completed"],
  ["citizenship_in_the_nation", 2, 0, "assigned"],
  ["wilderness_survival", 0, 0, "in_progress"],
];

export default async function DemoAdvancement({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const isLeader = view !== "scout";
  const supabase = await createClient();
  const items: Item[] = await loadCatalog(supabase);
  const byCode = Object.fromEntries(items.map((i) => [i.code, i]));

  const tracked: Tracked[] = [];
  const progress: Progress = {};
  for (const [code, signed, doneOnly, status] of DEMO) {
    const item = byCode[code];
    if (!item) continue;
    if (item.kind === "badge" || status === "completed") tracked.push({ item_id: item.id, status, assigned_by: status === "assigned" ? "leader" : null });
    item.requirements.forEach((r, i) => {
      if (i < signed) progress[r.id] = { completed_at: "2026-09-01", approved_by: "leader" };
      else if (i < signed + doneOnly) progress[r.id] = { completed_at: "2026-10-01", approved_by: null };
    });
  }

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50 flex gap-1 bg-white rounded-full p-1 shadow-lg border border-[#D5DFDA] text-[12px] font-bold">
        <Link href="/demo/advancement" className="px-3 py-1.5 rounded-full no-underline"
          style={{ background: isLeader ? "#1F5F4A" : "transparent", color: isLeader ? "white" : "#4D5F57" }}>Leader view</Link>
        <Link href="/demo/advancement?view=scout" className="px-3 py-1.5 rounded-full no-underline"
          style={{ background: !isLeader ? "#1F5F4A" : "transparent", color: !isLeader ? "white" : "#4D5F57" }}>Scout view</Link>
      </div>
      <AdvancementClient
        key={isLeader ? "leader" : "scout"}
        scout={{ id: "demo-scout", first_name: "Jake", last_name: "Garcia" }}
        orgId="demo"
        items={items}
        tracked={tracked}
        progress={progress}
        isLeader={isLeader}
        viewerPersonId={isLeader ? "leader" : "demo-scout"}
        demo
      />
    </>
  );
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AdvancementClient, { type Progress } from "@/components/AdvancementClient";
import { loadCatalog } from "@/lib/advancement";

// [adventure code, requirements signed off, extra done-but-unsigned]
const DEMO: [string, number, number][] = [
  ["cub_bobcat_wolf", 99, 0],
  ["cub_running_with_the_pack", 99, 0],
  ["cub_safety_in_numbers", 99, 0],
  ["cub_footsteps", 2, 1],
  ["cub_council_fire", 3, 0],
  ["cub_finding_your_way", 99, 0],
  ["cub_germs_alive", 1, 2],
];

export default async function DemoCubs({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const isLeader = view !== "scout";
  const items = await loadCatalog(await createClient());
  const byCode = Object.fromEntries(items.map((i) => [i.code, i]));

  const progress: Progress = {};
  for (const [code, signed, doneOnly] of DEMO) {
    byCode[code]?.requirements.forEach((r, i) => {
      if (i < signed) progress[r.id] = { completed_at: "2026-09-01", approved_by: "leader" };
      else if (i < signed + doneOnly) progress[r.id] = { completed_at: "2026-10-01", approved_by: null };
    });
  }
  for (const code of ["cub_bobcat_lion","cub_fun_on_the_run","cub_lions_roar","cub_lions_pride","cub_king_of_the_jungle","cub_mountain_lion","cub_go_fish","cub_on_a_roll",
                      "cub_bobcat_tiger","cub_tiger_bites","cub_tigers_roar","cub_tiger_circles","cub_team_tiger","cub_tigers_in_the_wild","cub_fish_on","cub_tiger_tag"]) {
    byCode[code]?.requirements.forEach((r) => { progress[r.id] = { completed_at: "2025-05-01", approved_by: "leader" }; });
  }

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50 flex gap-1 bg-white rounded-full p-1 shadow-lg border border-[#D5DFDA] text-[12px] font-bold">
        <Link href="/demo/cubs" className="px-3 py-1.5 rounded-full no-underline"
          style={{ background: isLeader ? "#1F5F4A" : "transparent", color: isLeader ? "white" : "#4D5F57" }}>Den leader view</Link>
        <Link href="/demo/cubs?view=scout" className="px-3 py-1.5 rounded-full no-underline"
          style={{ background: !isLeader ? "#1F5F4A" : "transparent", color: !isLeader ? "white" : "#4D5F57" }}>Family view</Link>
      </div>
      <AdvancementClient
        key={isLeader ? "leader" : "scout"}
        scout={{ id: "demo-cub", first_name: "Maya", last_name: "Chen" }}
        orgId="demo"
        items={items}
        tracked={[]}
        progress={progress}
        isLeader={isLeader}
        viewerPersonId={isLeader ? "leader" : "demo-cub"}
        program="cubs"
        demo
      />
    </>
  );
}

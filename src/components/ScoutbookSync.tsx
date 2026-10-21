"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Scoutbook is the official record. Shows how much completed advancement isn't in an upload
// file yet and downloads a changes-only file (which marks those rows exported).
export default function ScoutbookSync({ pending, compact = false }: { pending: number | null; compact?: boolean }) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  if (pending === null) return null; // tracking not available yet (migration not applied)

  if (pending === 0 || done) {
    return compact ? null : (
      <div className="card flex items-center gap-3 flex-wrap">
        <span className="flex-1 text-[15px]"><b>Scoutbook is up to date.</b> <span className="text-smoke">Everything completed here is in an upload file.</span></span>
        <a href="/api/export/advancement.csv" className="text-[14px] font-bold text-forest">Full history file</a>
      </div>
    );
  }

  return (
    <div className="card flex items-center gap-4 flex-wrap" style={{ background: "#FFF6D6" }}>
      <div className="flex-1 min-w-[240px] flex flex-col gap-0.5">
        <span className="font-bold text-[16px]" style={{ color: "#5E4400" }}>
          {pending === 1 ? "1 completed item isn't" : `${pending} completed items aren't`} in Scoutbook yet
        </span>
        <span className="text-[13px]" style={{ color: "#5E4400" }}>
          Download the file, then in Scoutbook Plus open your unit roster and import it. Council needs it there before awards can be bought.
        </span>
      </div>
      <a href="/api/export/advancement.csv?new=1" className="btn-primary no-underline"
        onClick={() => { setTimeout(() => { setDone(true); router.refresh(); }, 1500); }}>
        Download upload file
      </a>
    </div>
  );
}

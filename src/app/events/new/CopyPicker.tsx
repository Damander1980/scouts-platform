"use client";

import { useRouter } from "next/navigation";

export default function CopyPicker({ events, current }: { events: { id: string; title: string; start_at: string }[]; current: string }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-3 flex-wrap text-[14px] font-bold max-w-2xl">
      Start from a past event
      <select className="input flex-1 min-w-[220px]" value={current} onChange={(e) => router.push(e.target.value ? `/events/new?copy=${e.target.value}` : "/events/new")}>
        <option value="">Blank event</option>
        {events.map((e) => <option key={e.id} value={e.id}>{e.title} · {new Date(e.start_at).toLocaleDateString()}</option>)}
      </select>
    </label>
  );
}

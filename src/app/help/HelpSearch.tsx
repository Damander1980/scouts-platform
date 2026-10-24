"use client";

import Link from "next/link";
import { useState } from "react";

type Hit = { slug: string; title: string; summary: string; section: string; text: string };

export default function HelpSearch({ items }: { items: Hit[] }) {
  const [q, setQ] = useState("");
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = words.length ? items.filter((i) => words.every((w) => i.text.includes(w))).slice(0, 8) : [];
  return (
    <div className="relative max-w-xl">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search help, e.g. waitlist, health form, dues"
        aria-label="Search help" className="input w-full text-ink" />
      {words.length > 0 && (
        <div className="absolute z-10 left-0 right-0 mt-2 card p-0 overflow-hidden text-ink">
          {hits.length === 0 && <div className="p-4 text-smoke text-[14px]">Nothing found. Try another word.</div>}
          {hits.map((h) => (
            <Link key={h.slug} href={`/help/${h.slug}`} className="block px-4 py-3 no-underline text-ink border-b border-[#EAE4D6] last:border-0 min-h-[44px]">
              <div className="font-bold text-[15px]">{h.title}</div>
              <div className="text-[13px] text-smoke">{h.section} · {h.summary}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

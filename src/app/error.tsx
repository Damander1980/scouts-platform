"use client";

import Link from "next/link";
import Mark from "@/components/Mark";

// Friendly fallback when a page fails to load (network hiccup, service down). Never shows technical details.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-5">
      <div className="w-full max-w-[460px] bg-white rounded-[20px] p-8 flex flex-col gap-4 items-start" style={{ boxShadow: "0 1px 2px rgba(16,27,45,.06), 0 14px 36px rgba(16,27,45,.12)" }}>
        <Mark size={44} />
        <h1 className="font-display font-extrabold text-[30px] leading-tight m-0">Something went wrong</h1>
        <p className="text-[16px] text-smoke m-0">This page didn&apos;t load. Try again, and if it keeps happening, let us know.</p>
        <div className="flex gap-3 flex-wrap">
          <button className="btn-primary" onClick={reset}>Try again</button>
          <Link href="/home" className="btn-secondary no-underline">Go to my home</Link>
        </div>
      </div>
    </div>
  );
}

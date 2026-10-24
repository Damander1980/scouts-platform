import Link from "next/link";
import Mark from "@/components/Mark";

// Branded "not found" for bad links (mistyped troop pages, old event links).
export default function NotFound() {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-5">
      <div className="w-full max-w-[460px] bg-white rounded-[20px] p-8 flex flex-col gap-4 items-start" style={{ boxShadow: "0 1px 2px rgba(16,27,45,.06), 0 14px 36px rgba(16,27,45,.12)" }}>
        <Mark size={44} />
        <h1 className="font-display font-extrabold text-[30px] leading-tight m-0">Off the trail</h1>
        <p className="text-[16px] text-smoke m-0">That page doesn&apos;t exist, or the link has expired. If a leader sent it, ask them for a fresh one.</p>
        <div className="flex gap-3 flex-wrap">
          <Link href="/home" className="btn-primary no-underline">Go to my home</Link>
          <Link href="/" className="btn-secondary no-underline">Our Troop Manager</Link>
        </div>
      </div>
    </div>
  );
}

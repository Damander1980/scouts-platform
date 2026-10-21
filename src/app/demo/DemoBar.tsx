"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Slim bar on every sample screen so visitors know nothing saves and can get back to the tour.
export default function DemoBar() {
  const path = usePathname();
  if (path === "/demo/tour" || path === "/demo") return null; // these have their own header and note
  return (
    <div className="print:hidden flex items-center gap-3 px-4 min-h-[44px] text-[14px] font-bold flex-wrap" style={{ background: "#FFF6D6", color: "#5E4400" }}>
      <span className="flex-1">Sample screen with made-up families. Nothing here saves.</span>
      <Link href="/demo/tour" className="text-forest min-h-[44px] flex items-center">Back to the tour</Link>
      <Link href="/login?next=/setup" className="text-forest min-h-[44px] flex items-center">Start free</Link>
    </div>
  );
}

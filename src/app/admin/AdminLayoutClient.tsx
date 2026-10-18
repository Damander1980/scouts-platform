"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ROLE_LABELS: Record<string, string> = {
  scoutmaster: "Scoutmaster", assistant_scoutmaster: "Asst. Scoutmaster",
  committee_chair: "Committee Chair", committee_member: "Committee Member",
  treasurer: "Treasurer", advancement_chair: "Advancement Chair",
  chartered_org_rep: "Chartered Org Rep", den_leader: "Den Leader",
  cubmaster: "Cubmaster", crew_advisor: "Crew Advisor", skipper: "Skipper",
};

const NAV = [
  { path: "/admin", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { path: "/admin/members", label: "Members", icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" },
  { path: "/admin/households", label: "Households", icon: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10" },
  { path: "/admin/events", label: "Events", icon: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" },
  { path: "/admin/ledger", label: "Ledger", icon: "M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" },
  { path: "/admin/forms", label: "Forms", icon: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" },
  { path: "/admin/settings", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];

export default function AdminLayoutClient({
  children, person, org, role,
}: {
  children: React.ReactNode;
  person: { id: string; first_name: string; last_name: string };
  org: { id: string; name: string; type: string; unit_number: string; city: string; join_code: string };
  role: string;
}) {
  const pathname = usePathname();
  const supabase = createClient();
  const unitWord = org.type === "cubs" ? "Pack" : org.type === "venturing" ? "Crew" : org.type === "sea" ? "Ship" : "Troop";

  const isActive = (path: string) =>
    path === "/admin" ? pathname === "/admin" : pathname.startsWith(path);

  return (
    <div className="flex min-h-screen" style={{ fontFamily: "'DM Sans', sans-serif", color: "#14211B", background: "#F4F6F5" }}>

      {/* ── Sidebar ── */}
      <aside className="w-56 flex-none flex flex-col bg-forest text-white min-h-screen sticky top-0 h-screen">
        <div className="px-5 pt-6 pb-4 border-b border-white/10">
          <div className="font-display font-extrabold text-[18px] leading-tight">
            {unitWord} {org.unit_number}
          </div>
          <div className="text-[12px] mt-0.5" style={{ color: "#9DB0A7" }}>Admin Portal · {org.city}</div>
        </div>

        <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5">
          {NAV.map((n) => (
            <Link key={n.path} href={n.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-bold no-underline transition-colors ${
                isActive(n.path)
                  ? "bg-white/15 text-white"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              }`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={n.icon}/>
              </svg>
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-white/10 flex flex-col gap-1">
          <div className="text-[13px] font-bold text-white">{person.first_name} {person.last_name}</div>
          <div className="text-[12px]" style={{ color: "#9DB0A7" }}>{ROLE_LABELS[role] ?? role}</div>
          <button
            onClick={() => supabase.auth.signOut().then(() => window.location.href = "/login")}
            className="mt-2 text-[12px] font-bold text-white/50 hover:text-white text-left bg-transparent border-0 p-0 cursor-pointer"
            style={{ fontFamily: "inherit" }}>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 px-8 py-8 max-w-5xl">
        {children}
      </main>
    </div>
  );
}

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

// `need`: show the item if the person holds any of these permissions (omitted = everyone with tools).
// Hiding is convenience only; each page and the database enforce access themselves.
const NAV: { path: string; label: string; icon: string; need?: string[] }[] = [
  { path: "/admin", label: "Overview", icon: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10" },
  { path: "/admin/members", label: "Members", need: ["leader", "members.manage", "members.private"], icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" },
  { path: "/admin/patrols", label: "Patrols & positions", icon: "M4 21V5m0 0h11l-2 4 2 4H4" },
  { path: "/events", label: "Events", icon: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" },
  { path: "/admin/attendance", label: "Attendance", icon: "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" },
  { path: "/admin/advancement", label: "Advancement", icon: "M12 15a6 6 0 100-12 6 6 0 000 12zM8.5 14L7 22l5-3 5 3-1.5-8" },
  { path: "/admin/forms", label: "Forms & safety", icon: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 15l2 2 4-4" },
  { path: "/admin/money", label: "Money", icon: "M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" },
  { path: "/admin/messages", label: "Message log", icon: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" },
  { path: "/admin/volunteer", label: "Volunteers & polls", icon: "M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 11l2 2 4-4" },
  { path: "/admin/gear", label: "Gear & documents", icon: "M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10" },
  { path: "/admin/recharter", label: "Recharter", icon: "M4 4h16v16H4zM8 9h8M8 13h8M8 17h5" },
  { path: "/admin/import", label: "Import & export", icon: "M12 3v12M7 10l5 5 5-5M4 21h16" },
  { path: "/admin/site", label: "Website", icon: "M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" },
  { path: "/admin/settings", label: "Unit settings", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" },
  { path: "/admin/activity", label: "Activity log", need: ["__admin_only__"], icon: "M12 8v4l3 3M12 21a9 9 0 100-18 9 9 0 000 18z" },
  { path: "/admin/positions", label: "Positions & access", icon: "M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6zM9 12l2 2 4-4" },
];

const NEED: Record<string, string[]> = {
  "/admin/patrols": ["leader"],
  "/events": ["leader", "events.manage"],
  "/admin/attendance": ["leader"],
  "/admin/advancement": ["leader"],
  "/admin/forms": ["leader", "medical.view", "medical.record"],
  "/admin/money": ["money.view", "money.manage", "fundraising.manage"],
  "/admin/volunteer": ["leader", "volunteer.manage"],
  "/admin/gear": ["leader", "gear.manage", "docs.manage"],
  "/admin/import": ["leader", "members.private"],
  "/admin/recharter": ["leader", "members.manage", "money.manage"],
  "/admin/site": ["leader", "site.edit"],
};

const SHIELD = "M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6zM9 12l2 2 4-4";
// Seven sections instead of sixteen links. A section's pages appear under it only while you're in it.
const GROUPS: { label: string; icon?: string; paths: string[]; sub?: Record<string, string> }[] = [
  { label: "Overview", paths: ["/admin"] },
  { label: "People", paths: ["/admin/members", "/admin/patrols", "/admin/positions", "/admin/recharter"],
    sub: { "/admin/patrols": "Patrols", "/admin/positions": "Positions & access" } },
  { label: "Calendar", paths: ["/events", "/admin/attendance", "/admin/volunteer"],
    sub: { "/events": "Events", "/admin/volunteer": "Volunteers & polls" } },
  { label: "Advancement", paths: ["/admin/advancement"] },
  { label: "Safety", icon: SHIELD, paths: ["/admin/forms", "/admin/messages", "/admin/activity"], sub: { "/admin/forms": "Health forms & YPT" } },
  { label: "Money", paths: ["/admin/money"] },
  { label: "Unit", paths: ["/admin/settings", "/admin/site", "/admin/gear", "/admin/import"],
    sub: { "/admin/settings": "Settings" } },
];

const PERM_LABELS: Record<string, string> = {
  "members.private": "private member details", "medical.view": "health form status",
  "medical.record": "recording health forms", "messages.audit": "the full message log",
};

export default function AdminLayoutClient({
  children, person, org, role, perms, isAdmin, yptBlocked,
}: {
  children: React.ReactNode;
  person: { id: string; first_name: string; last_name: string };
  org: { id: string; name: string; type: string; unit_number: string | null; city: string | null };
  role: string;
  perms: string[];
  isAdmin: boolean;
  yptBlocked: string[];
}) {
  const nav = NAV.filter((n) => {
    const need = n.need ?? NEED[n.path];
    return isAdmin || !need || need.some((p) => perms.includes(p));
  });
  const pathname = usePathname();
  const supabase = createClient();
  const unitWord = org.type === "cubs" ? "Pack" : org.type === "venturing" ? "Crew" : org.type === "sea" ? "Ship" : "Troop";
  const isActive = (path: string) => (path === "/admin" ? pathname === "/admin" : pathname.startsWith(path));
  const byPath = Object.fromEntries(nav.map((n) => [n.path, n]));
  const groups = GROUPS.map((g) => ({ ...g, items: g.paths.filter((p) => byPath[p]).map((p) => ({ ...byPath[p], label: g.sub?.[p] ?? byPath[p].label })) }))
    .filter((g) => g.items.length > 0)
    .map((g) => ({ ...g, href: g.items[0].path, icon: g.icon ?? g.items[0].icon, open: g.items.some((i) => isActive(i.path)) }));
  const signOut = () => { navigator.serviceWorker?.controller?.postMessage("clear-private"); supabase.auth.signOut().then(() => (window.location.href = "/login")); };

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col">
      <header className="hidden md:flex print:hidden bg-forest text-white sticky top-0 z-30 h-16 items-center gap-3 px-6">
        <Link href="/dashboard" aria-label="Home" className="flex items-center gap-2.5 no-underline text-white">
          <span className="w-9 h-9 rounded-[10px] flex items-center justify-center font-display font-extrabold text-[16px]" style={{ background: "#F5B700", color: "#101B2D" }}>S</span>
          <span className="font-display font-extrabold text-[19px]">ScoutPlatform</span>
        </Link>
        <span className="ml-4 min-h-[40px] px-4 rounded-full font-bold text-[14px] flex items-center" style={{ background: "#F5B700", color: "#101B2D" }}>{unitWord} {org.unit_number}</span>
        <span className="text-[14px]" style={{ color: "#D7E0EE" }}>Leader tools</span>
        <form action="/admin/members" className="ml-6 flex items-center rounded-full px-4 min-h-[40px] gap-2 min-w-[240px]" style={{ background: "#0C2442" }}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D7E0EE" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
          <input name="q" aria-label="Find a member" placeholder="Find a member" className="bg-transparent border-0 text-white text-[14px] outline-none flex-1 font-sans placeholder:text-[#AEB9C9]" />
        </form>
        <Link href="/dashboard" className="ml-auto text-[14px] font-bold no-underline min-h-[40px] px-4 rounded-full flex items-center" style={{ color: "#FFFFFF", border: "1px solid rgba(255,255,255,.3)" }}>Family view</Link>
        <div className="flex flex-col items-end leading-tight">
          <span className="text-[14px] font-bold">{person.first_name} {person.last_name}</span>
          <span className="text-[12px]" style={{ color: "#D7E0EE" }}>{ROLE_LABELS[role] ?? role} · <button onClick={signOut} className="bg-transparent border-0 p-0 cursor-pointer font-sans text-[12px] font-bold underline" style={{ color: "#D7E0EE" }}>Sign out</button></span>
        </div>
      </header>
      <div className="md:flex flex-1">
      <aside className="hidden md:flex print:hidden w-60 flex-none flex-col bg-forest-deep text-white sticky top-16 h-[calc(100vh-4rem)]">
        <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1">
          {groups.map((g) => (
            <div key={g.label} className="flex flex-col gap-0.5">
              <Link href={g.href}
                className="flex items-center gap-3 px-3.5 min-h-[44px] rounded-[10px] text-[15px] no-underline"
                style={g.open
                  ? { background: "#12355F", color: "#FFFFFF", fontWeight: 700, boxShadow: "inset 3px 0 0 #F5B700" }
                  : { color: "#D7E0EE" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={g.icon}/></svg>
                {g.label}
              </Link>
              {g.open && g.items.length > 1 && g.items.map((i) => (
                <Link key={i.path} href={i.path}
                  className="ml-9 pl-3 min-h-[38px] flex items-center rounded-lg text-[14px] no-underline"
                  style={isActive(i.path) ? { color: "#F5B700", fontWeight: 700 } : { color: "#AEB9C9" }}>
                  {i.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="md:hidden print:hidden bg-forest text-white sticky top-0 z-30">
        <div className="flex items-center gap-3 px-4 h-12">
          <Link href="/dashboard" className="text-white no-underline font-bold text-[14px]">←</Link>
          <span className="font-bold text-[15px]">{unitWord} {org.unit_number} · Leaders</span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {groups.map((g) => (
            <Link key={g.label} href={g.href}
              className="px-3 min-h-[36px] flex items-center rounded-full text-[13px] font-bold no-underline whitespace-nowrap"
              style={{ background: g.open ? "rgba(255,255,255,0.2)" : "transparent", color: g.open ? "white" : "#D7E0EE" }}>
              {g.label}
            </Link>
          ))}
        </nav>
        {groups.filter((g) => g.open && g.items.length > 1).map((g) => (
          <nav key={g.label} aria-label={`${g.label} pages`} className="flex gap-1 overflow-x-auto px-3 pb-2">
            {g.items.map((i) => (
              <Link key={i.path} href={i.path} className="px-3 min-h-[32px] flex items-center text-[12px] font-bold no-underline whitespace-nowrap"
                style={{ color: isActive(i.path) ? "#F5B700" : "#AEB9C9" }}>{i.label}</Link>
            ))}
          </nav>
        ))}
      </div>

      <main className="flex-1 min-w-0 px-4 md:px-8 py-6 md:py-8 max-w-6xl w-full mx-auto flex flex-col gap-5">
        {yptBlocked.length > 0 && (
          <div className="card" style={{ background: "#FFF6D6", borderColor: "#F0DA8C" }}>
            <b>Youth Protection Training needed.</b> Your position includes {yptBlocked.map((p) => PERM_LABELS[p] ?? p).join(", ")}, but
            no current YPT date is on file for you. {isAdmin
              ? <>Enter your YPT expiration date on the <Link href="/admin/members" className="font-bold text-forest">Members page</Link> to turn these on.</>
              : "Ask a unit admin to record your YPT expiration date to turn these on."}
          </div>
        )}
        {children}
      </main>
      </div>
    </div>
  );
}
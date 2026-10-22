"use client";

import Link from "next/link";
import Mark from "@/components/Mark";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

type OrgOption = { id: string; label: string };

const ICON: Record<string, string> = {
  home: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  events: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z",
  pay: "M2 7h20v12H2zM2 11h20",
  forms: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 15l2 2 4-4",
  patrol: "M4 21V5m0 0h11l-2 4 2 4H4",
  family: "M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 11a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM16 14c3 0 5 1.7 5 5",
  messages: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  leader: "M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z",
  settings: "M12 15a3 3 0 100-6 3 3 0 000 6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4",
};

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON[name]} />
    </svg>
  );
}

export default function AppShell({
  children, orgName, orgs, currentOrgId, initials, isLeader, unread = 0, demo = false,
}: {
  children: ReactNode; orgName: string; orgs: OrgOption[]; currentOrgId: string;
  initials: string; isLeader: boolean; unread?: number; demo?: boolean;
}) {
  const rawPath = usePathname();
  // Sample screens: links stay inside the demo, and the sidebar highlights what they stand in for.
  const DEMO: Record<string, string> = { "/dashboard": "/demo", "/events": "/demo/calendar", "/admin": "/demo/leader" };
  const to = (href: string) => (demo ? DEMO[href] ?? "/demo/tour" : href);
  const pathname = demo ? (Object.entries(DEMO).find(([, v]) => v === rawPath)?.[0] ?? rawPath) : rawPath;
  const router = useRouter();
  const [menu, setMenu] = useState(false);

  // Phone bottom bar keeps five items; the desktop sidebar shows everything.
  const mobileNav = [
    { href: "/dashboard", label: "Home", icon: "home" },
    { href: "/events", label: "Events", icon: "events" },
    { href: "/family", label: "Family", icon: "family" },
    { href: "/messages", label: "Messages", icon: "messages", badge: unread },
    ...(isLeader ? [{ href: "/admin", label: "Leaders", icon: "leader" }] : []),
  ];
  const sideNav = [
    { href: "/dashboard", label: "Home", icon: "home" },
    { href: "/events", label: "Events", icon: "events" },
    { href: "/pay", label: "Pay", icon: "pay" },
    { href: "/forms", label: "Forms", icon: "forms" },
    { href: "/patrols", label: "Patrol", icon: "patrol" },
    { href: "/messages", label: "Messages", icon: "messages", badge: unread },
    { href: "/family", label: "Family", icon: "family" },
    { href: "/settings", label: "Settings", icon: "settings" },
  ];
  const active = (href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));

  async function switchOrg(id: string) {
    const res = await fetch("/api/switch-org", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orgId: id }) }).catch(() => null);
    // Never leave a leader thinking they switched troops when they didn't.
    if (!res?.ok) { window.alert("Couldn't switch troops. Check your connection and try again."); return; }
    setMenu(false);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink">
      <header className="text-white sticky top-0 z-30 print:static" style={{ background: "linear-gradient(90deg, #0C2442 0%, #12355F 60%, #17437A 100%)", boxShadow: "inset 0 -3px 0 #F5B700" }}>
        <div className="px-4 md:px-6 h-16 flex items-center gap-3">
          <Link href={to("/dashboard")} aria-label="Home" className="flex items-center gap-2.5 no-underline text-white flex-none">
            <Mark size={36} />
            <span className="hidden md:inline font-display font-extrabold text-[19px] tracking-[-0.01em]">ScoutPlatform</span>
          </Link>
          <button onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label="Switch unit"
            className="ml-1 md:ml-4 flex items-center gap-2 min-h-[40px] px-4 rounded-full border-0 cursor-pointer font-sans font-bold text-[14px] min-w-0"
            style={{ background: "#F5B700", color: "#101B2D" }}>
            <span className="truncate">{orgName}</span>
            {orgs.length > 1 && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
            )}
          </button>
          <Link href={to("/settings")} aria-label="Settings"
            className="ml-auto w-10 h-10 rounded-full flex items-center justify-center font-bold text-[13px] no-underline flex-none"
            style={{ background: "#0C2442", color: "#FFFFFF" }}>
            {initials}
          </Link>
        </div>
        {menu && (
          <div className="px-4 md:px-6 pb-3 flex flex-col gap-1 max-w-md">
            {orgs.map((o) => (
              <button key={o.id} onClick={() => switchOrg(o.id)}
                className="text-left px-3 py-2.5 rounded-lg border-0 cursor-pointer font-sans text-[15px] font-bold min-h-[44px]"
                style={{ background: o.id === currentOrgId ? "rgba(255,255,255,0.18)" : "transparent", color: "white" }}>
                {o.label}
              </button>
            ))}
            <Link href="/welcome?step=troop" className="px-3 py-2.5 text-[14px] font-bold no-underline min-h-[44px] flex items-center" style={{ color: "#D7E0EE" }}>
              + Join or start another troop
            </Link>
          </div>
        )}
      </header>

      <div className="flex flex-1">
        <aside className="hidden md:flex flex-col w-60 flex-none px-3 py-5 gap-1 sticky top-16 self-start h-[calc(100vh-4rem)] print:hidden"
          style={{ background: "var(--topo-dark), #0C2442", backgroundSize: "480px 480px" }}>
          <div className="eyebrow px-3.5 pb-2" style={{ color: "#8FA3C0" }}>Trail map</div>
          {/* The nav reads as a trail: a dashed path linking blaze markers, current stop in gold. */}
          <div className="relative flex flex-col gap-1">
            <span aria-hidden="true" className="absolute left-[27px] top-5 bottom-5 border-l-2 border-dashed" style={{ borderColor: "rgba(215,224,238,.18)" }} />
          {sideNav.map((n) => (
            <Link key={n.href} href={to(n.href)}
              className="relative flex items-center gap-3 min-h-[44px] px-3.5 rounded-xl text-[15px] no-underline transition-colors hover:bg-white/5"
              style={active(n.href)
                ? { background: "rgba(245,183,0,.12)", color: "#FFFFFF", fontWeight: 700 }
                : { color: "#D7E0EE" }}>
              <span className="relative z-10 w-7 h-7 -ml-0.5 rounded-full flex items-center justify-center flex-none"
                style={active(n.href) ? { background: "#F5B700", color: "#0C2442" } : { background: "#12355F", color: "#D7E0EE", boxShadow: "0 0 0 3px #0C2442" }}>
                <Icon name={n.icon} size={15} />
              </span>
              <span className="flex-1">{n.label}</span>
              {!!n.badge && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center" style={{ background: "#F5B700", color: "#101B2D" }}>{n.badge}</span>
              )}
            </Link>
          ))}
          </div>
          {isLeader && (
            <Link href={to("/admin")} className="mt-auto flex items-center gap-3 min-h-[44px] px-3.5 rounded-[10px] text-[15px] font-bold no-underline"
              style={{ background: "#F5B700", color: "#101B2D" }}>
              <Icon name="leader" />Leader tools
            </Link>
          )}
        </aside>

        <main className="flex-1 min-w-0 px-4 md:px-8 py-6 md:py-8 pb-28 md:pb-10">
          <div className="max-w-6xl mx-auto flex flex-col gap-5">{children}</div>
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white z-30 pb-[env(safe-area-inset-bottom)]" style={{ boxShadow: "0 -6px 20px rgba(16,27,45,.08)", borderTop: "3px solid #F5B700" }}>
        <div className="flex justify-around px-1 pt-1.5 pb-2">
          {mobileNav.map((n) => (
            <Link key={n.href} href={to(n.href)}
              className="relative flex flex-col items-center gap-0.5 min-w-[56px] min-h-[48px] justify-center no-underline"
              style={{ color: active(n.href) ? "#12355F" : "#4B5568" }}>
              {active(n.href) && <span aria-hidden="true" className="absolute -top-1.5 w-7 h-[4px] rounded-full" style={{ background: "#F5B700" }} />}
              <Icon name={n.icon} size={22} />
              <span className="text-[11px] font-bold">{n.label}</span>
              {!!n.badge && (
                <span className="absolute top-0 right-2 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
                  style={{ background: "#F5B700", color: "#101B2D" }}>{n.badge}</span>
              )}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

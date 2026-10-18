"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

type OrgOption = { id: string; label: string };

const ICON: Record<string, string> = {
  home: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  events: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z",
  family: "M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 11a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM16 14c3 0 5 1.7 5 5",
  messages: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  leader: "M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z",
};

export default function AppShell({
  children, orgName, orgs, currentOrgId, initials, isLeader, unread = 0,
}: {
  children: ReactNode; orgName: string; orgs: OrgOption[]; currentOrgId: string;
  initials: string; isLeader: boolean; unread?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState(false);

  const nav = [
    { href: "/dashboard", label: "Home", icon: "home" },
    { href: "/events", label: "Events", icon: "events" },
    { href: "/family", label: "Family", icon: "family" },
    { href: "/messages", label: "Messages", icon: "messages", badge: unread },
    ...(isLeader ? [{ href: "/admin", label: "Leaders", icon: "leader" }] : []),
  ];
  const active = (href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));

  async function switchOrg(id: string) {
    await fetch("/api/switch-org", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orgId: id }) });
    setMenu(false);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink">
      <header className="bg-forest text-white sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => setMenu(!menu)} aria-expanded={menu}
            className="flex items-center gap-2 bg-transparent border-0 text-white cursor-pointer p-0 font-sans min-w-0">
            <span className="w-8 h-8 rounded-full bg-white text-forest flex items-center justify-center font-display font-extrabold text-[12px] flex-none">SP</span>
            <span className="font-bold text-[15px] truncate">{orgName}</span>
            {orgs.length > 1 && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
            )}
          </button>
          <nav className="hidden md:flex items-center gap-1 ml-6">
            {nav.map((n) => (
              <Link key={n.href} href={n.href}
                className="px-3 py-2 rounded-lg text-[14px] font-bold no-underline"
                style={{ color: active(n.href) ? "#FFFFFF" : "#CFE0D7", background: active(n.href) ? "rgba(255,255,255,0.15)" : "transparent" }}>
                {n.label}{n.badge ? ` (${n.badge})` : ""}
              </Link>
            ))}
          </nav>
          <Link href="/settings" aria-label="Settings"
            className="ml-auto w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-[13px] no-underline flex-none">
            {initials}
          </Link>
        </div>
        {menu && (
          <div className="max-w-5xl mx-auto px-4 pb-3 flex flex-col gap-1">
            {orgs.map((o) => (
              <button key={o.id} onClick={() => switchOrg(o.id)}
                className="text-left px-3 py-2.5 rounded-lg border-0 cursor-pointer font-sans text-[15px] font-bold"
                style={{ background: o.id === currentOrgId ? "rgba(255,255,255,0.18)" : "transparent", color: "white" }}>
                {o.label}
              </button>
            ))}
            <Link href="/welcome?step=troop" className="px-3 py-2.5 text-[14px] font-bold no-underline" style={{ color: "#CFE0D7" }}>
              + Join or start another troop
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-5 pb-28 md:pb-10 flex flex-col gap-5">{children}</main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-border z-30 pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around px-1 pt-1.5 pb-2">
          {nav.map((n) => (
            <Link key={n.href} href={n.href}
              className="relative flex flex-col items-center gap-0.5 min-w-[56px] min-h-[48px] justify-center no-underline"
              style={{ color: active(n.href) ? "#1F5F4A" : "#4D5F57" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={ICON[n.icon]} />
              </svg>
              <span className="text-[11px] font-bold">{n.label}</span>
              {!!n.badge && (
                <span className="absolute top-0 right-2 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
                  style={{ background: "#FF6A1A", color: "#14211B" }}>{n.badge}</span>
              )}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

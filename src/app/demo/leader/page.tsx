import Link from "next/link";
import AdminLayoutClient from "@/app/admin/AdminLayoutClient";
import { Stat } from "@/components/ui";

// Sample leader Overview with made-up numbers, laid out like the real /admin. Nothing here saves.
const org = { id: "demo", name: "Troop 999", type: "scouts_bsa", unit_number: "999", city: "Plano, TX" };
const me = { id: "demo", first_name: "Floyd", last_name: "Kobler" };
const FLOAT = { boxShadow: "0 2px 4px rgba(16,27,45,.08), 0 14px 32px rgba(16,27,45,.18)" };

export default function DemoLeaderOverview() {
  const actions: [string, string, string][] = [
    ["Post an event", "M12 5v14M5 12h14", "/demo/calendar"],
    ["Message the troop", "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z", "/demo/tour"],
    ["Record cash or check", "M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6", "/demo/tour"],
    ["Sign off advancement", "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11", "/demo/advancement"],
  ];
  return (
    <AdminLayoutClient person={me} org={org} role="scoutmaster" perms={[]} isAdmin yptBlocked={[]} demo>
      <div>
        <h1 className="font-display font-extrabold text-[32px] leading-tight m-0">Overview</h1>
        <p className="text-[14px] m-0 mt-1 text-smoke">Troop 999 at a glance</p>
      </div>

      <div className="patch flex flex-wrap items-center gap-5">
        <div className="flex-1 min-w-[240px] flex flex-col gap-1">
          <span className="eyebrow" style={{ color: "#F5B700" }}>Next up · Fri, Oct 30</span>
          <span className="font-display font-extrabold text-[26px] leading-tight">Caprock Canyons campout</span>
          <span className="text-[14px]" style={{ color: "#D7E0EE" }}>Caprock Canyons State Park</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="font-display font-extrabold text-[36px] leading-none">24</span>
          <span className="text-[13px]" style={{ color: "#D7E0EE" }}>going so far</span>
        </div>
        <span className="min-h-[44px] px-5 rounded-full font-bold text-[15px] flex items-center" style={{ background: "#F5B700", color: "#101B2D" }}>Open roster</span>
      </div>

      <nav aria-label="Quick actions" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {actions.map(([label, icon, href]) => (
          <Link key={label} href={href} className="card !p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 no-underline text-ink min-h-[64px] min-w-0">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center text-forest flex-none" style={{ background: "#EEE8D9" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icon} /></svg>
            </span>
            <span className="font-bold text-[15px] leading-snug min-w-0">{label}</span>
          </Link>
        ))}
      </nav>

      <div className="card flex items-center gap-4 flex-wrap" style={{ background: "#FFF6D6" }}>
        <div className="flex-1 min-w-[240px]">
          <div className="font-bold text-[16px]" style={{ color: "#5E4400" }}>17 completed items aren&apos;t in Scoutbook yet</div>
          <div className="text-[13px]" style={{ color: "#5E4400" }}>Download the file, then import it in Scoutbook Plus. Council needs it there before awards can be bought.</div>
        </div>
        <span className="btn-primary">Download upload file</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Scouts" value={31} />
        <Stat label="Adults" value={44} />
        <Stat label="Upcoming events" value={9} />
        <Stat label="Owed to unit" value="$405.00" tone="#5E4400" />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="eyebrow m-0 text-smoke">Needs attention</h2>
        <div className="card p-0 overflow-hidden">
          {[["Families waiting to join", "2"], ["Requirements waiting for sign-off", "12"], ["Members without a current health form (A+B)", "4"], ["Youth Protection Training missing or expiring within 60 days", "3"]].map(([t, n]) => (
            <div key={t} className="flex justify-between items-center px-5 py-4 border-b border-[#EAE4D6] last:border-0">
              <b>{t}</b><span className="text-[13px] font-bold px-3 py-1 rounded-full" style={{ background: "#12355F", color: "#fff" }}>{n}</span>
            </div>
          ))}
        </div>
      </section>
    </AdminLayoutClient>
  );
}

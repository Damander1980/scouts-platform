import Link from "next/link";
import { requireLeader } from "@/lib/context";
import PrintButton from "@/components/PrintButton";
import { ROLE_LABELS } from "@/lib/context";
import { fmtDate } from "@/components/ui";

// Ready-made printable lists, like TroopWebHost's directories and reports. Roster-level data only;
// contact details and health status stay on their own permission-checked pages.
const REPORTS: [string, string][] = [
  ["ypt", "YPT aging"], ["patrols", "Patrol rosters"], ["leaders", "Leaders by position"], ["swim", "Swim test results"],
  ["counselors", "Merit badge counselors by badge"], ["sizes", "Shirt sizes"], ["dietary", "Allergies and dietary needs"],
  ["registrations", "Registration renewals"], ["families", "Scout and parent cross reference"], ["participation", "Participation (last 12 months)"], ["positions", "Youth positions"],
];
const SWIM: Record<string, string> = { swimmer: "Swimmer", beginner: "Beginner", nonswimmer: "Non-swimmer" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const { r = "ypt" } = await searchParams;
  const { supabase, current } = await requireLeader();
  const orgId = current.org.id;
  const { data: ms } = await supabase.from("memberships").select("person_id, role, position, ypt_expires, registration_expires, swim_class, uniform_size, persons(first_name, last_name, type)").eq("org_id", orgId).eq("status", "active");
  type M = { person_id: string; role: string; position: string | null; ypt_expires: string | null; registration_expires: string | null; swim_class: string | null; uniform_size: string | null; persons: { first_name: string; last_name: string; type: string } };
  const members = ((ms ?? []) as unknown as M[]).sort((a, b) => a.persons.last_name.localeCompare(b.persons.last_name) || a.persons.first_name.localeCompare(b.persons.first_name));
  const name = (m: M) => `${m.persons.last_name}, ${m.persons.first_name}`;
  const nameOf = Object.fromEntries(members.map((m) => [m.person_id, name(m)]));
  const leaders = members.filter((m) => m.persons.type === "adult" && !["parent_guardian"].includes(m.role));
  const youth = members.filter((m) => m.persons.type === "youth");
  const today = new Date();

  let body: React.ReactNode = null;
  if (r === "ypt") {
    const rows = leaders.map((m) => ({ m, days: m.ypt_expires ? Math.round((new Date(m.ypt_expires).getTime() - today.getTime()) / 86400000) : null }))
      .sort((a, b) => (a.days ?? -99999) - (b.days ?? -99999));
    body = <Table head={["Leader", "Position", "YPT expires", "Status"]} rows={rows.map(({ m, days }) => [name(m), ROLE_LABELS[m.role] ?? m.role, m.ypt_expires ? fmtDate(m.ypt_expires + "T12:00:00", { month: "short", day: "numeric", year: "numeric" }) : "Not recorded",
      days === null ? "Missing" : days < 0 ? "Expired" : days <= 60 ? `Expires in ${days} days` : "Current"])} />;
  } else if (r === "patrols") {
    const [{ data: patrols }, { data: pm }] = await Promise.all([
      supabase.from("patrols").select("id, name").eq("org_id", orgId).eq("active", true).order("name"),
      supabase.from("patrol_members").select("patrol_id, person_id, role").eq("org_id", orgId).is("end_date", null),
    ]);
    const inPatrol = new Set((pm ?? []).map((x) => x.person_id));
    body = (
      <div className="flex flex-col gap-5">
        {(patrols ?? []).map((p) => (
          <div key={p.id} className="break-inside-avoid">
            <h2 className="font-bold text-[16px] m-0 mb-1">{p.name}</h2>
            <Table head={["Scout", "Role"]} rows={(pm ?? []).filter((x) => x.patrol_id === p.id).map((x) => [nameOf[x.person_id] ?? "", x.role === "member" ? "" : x.role.replace(/_/g, " ")]).sort((a, b) => a[0].localeCompare(b[0]))} />
          </div>
        ))}
        <div className="break-inside-avoid">
          <h2 className="font-bold text-[16px] m-0 mb-1">Not in a patrol</h2>
          <Table head={["Scout"]} rows={youth.filter((m) => !inPatrol.has(m.person_id)).map((m) => [name(m)])} />
        </div>
      </div>
    );
  } else if (r === "leaders") {
    const byRole = leaders.reduce<Record<string, M[]>>((acc, m) => { (acc[ROLE_LABELS[m.role] ?? m.role] ??= []).push(m); return acc; }, {});
    body = <Table head={["Position", "Name", "Other position"]} rows={Object.entries(byRole).sort().flatMap(([role, list]) => list.map((m) => [role, name(m), m.position ?? ""]))} />;
  } else if (r === "swim") {
    body = <Table head={["Name", "Youth or adult", "Swim classification"]} rows={members.map((m) => [name(m), m.persons.type === "youth" ? "Scout" : "Adult", m.swim_class ? SWIM[m.swim_class] : "Not tested"])} />;
  } else if (r === "counselors") {
    const { data: mbc } = await supabase.from("merit_badge_counselors").select("person_id, advancement_items(name)").eq("org_id", orgId);
    const rows = ((mbc ?? []) as unknown as { person_id: string; advancement_items: { name: string } }[])
      .map((x) => [x.advancement_items.name, nameOf[x.person_id] ?? ""]).sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
    body = <Table head={["Merit badge", "Counselor"]} rows={rows} />;
  } else if (r === "sizes") {
    body = <Table head={["Name", "Youth or adult", "Shirt size"]} rows={members.map((m) => [name(m), m.persons.type === "youth" ? "Scout" : "Adult", m.uniform_size ?? ""])} />;
  } else if (r === "dietary") {
    const { data: rs } = await supabase.from("rsvps").select("person_id, dietary, rsvp_at, events!inner(org_id)").eq("events.org_id", orgId).not("dietary", "is", null).order("rsvp_at", { ascending: false });
    const latest = new Map<string, string>();
    for (const x of (rs ?? []) as { person_id: string; dietary: string | null }[]) if (x.dietary?.trim() && !latest.has(x.person_id)) latest.set(x.person_id, x.dietary.trim());
    body = <Table head={["Name", "Most recent allergy or dietary note"]} rows={[...latest.entries()].map(([pid, d]) => [nameOf[pid] ?? "", d]).filter((x) => x[0]).sort((a, b) => a[0].localeCompare(b[0]))} />;
  }

  if (r === "registrations") {
    const rows = members.filter((m) => m.persons.type === "adult")
      .sort((a, b) => (a.registration_expires ?? "0000").localeCompare(b.registration_expires ?? "0000"));
    body = <Table head={["Name", "Position", "Registration expires"]} rows={rows.map((m) => [name(m), ROLE_LABELS[m.role] ?? m.role,
      m.registration_expires ? fmtDate(m.registration_expires + "T12:00:00", { month: "short", day: "numeric", year: "numeric" }) : "Not recorded"])} />;
  } else if (r === "families") {
    const { data: hm } = await supabase.from("household_members").select("household_id, person_id, is_guardian, households!inner(org_id, name)").eq("households.org_id", orgId);
    const rowsF = ((hm ?? []) as unknown as { household_id: string; person_id: string; is_guardian: boolean; households: { name: string } }[]);
    const byHh = rowsF.reduce<Record<string, { name: string; scouts: string[]; parents: string[] }>>((acc, x) => {
      const h = (acc[x.household_id] ??= { name: x.households.name, scouts: [], parents: [] });
      const n = nameOf[x.person_id]; if (!n) return acc;
      (x.is_guardian ? h.parents : h.scouts).push(n); return acc;
    }, {});
    body = <Table head={["Family", "Scouts", "Parents and guardians"]} rows={Object.values(byHh).filter((h) => h.scouts.length).sort((a, b) => a.name.localeCompare(b.name)).map((h) => [h.name, h.scouts.join("; "), h.parents.join("; ")])} />;
  }

  if (r === "participation") {
    const since = new Date(Date.now() - 365 * 86400000).toISOString();
    const { data: att } = await supabase.from("attendance").select("person_id, present, events!inner(start_at, overnight_nights, service_hours, canceled)")
      .eq("org_id", orgId).eq("present", true).gte("events.start_at", since);
    type A = { person_id: string; events: { overnight_nights: number; service_hours: number; canceled: boolean } };
    const tally = new Map<string, { n: number; nights: number; hours: number }>();
    for (const a of (att ?? []) as unknown as A[]) {
      if (a.events.canceled) continue;
      const t = tally.get(a.person_id) ?? { n: 0, nights: 0, hours: 0 };
      t.n++; t.nights += Number(a.events.overnight_nights) || 0; t.hours += Number(a.events.service_hours) || 0;
      tally.set(a.person_id, t);
    }
    body = <Table head={["Name", "Events attended", "Nights camped", "Service hours"]} rows={members.map((m) => {
      const t = tally.get(m.person_id) ?? { n: 0, nights: 0, hours: 0 };
      return [name(m), String(t.n), String(t.nights), String(t.hours)];
    }).sort((a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0]))} />;
  }

  if (r === "positions") {
    const STANDARD = ["Senior Patrol Leader", "Assistant Senior Patrol Leader", "Troop Guide", "Quartermaster", "Scribe", "Historian", "Librarian",
      "Chaplain Aide", "Instructor", "Den Chief", "Order of the Arrow Troop Representative", "Outdoor Ethics Guide", "Webmaster", "Bugler"];
    const { data: lp } = await supabase.from("leadership_positions").select("person_id, title, start_date, end_date").eq("org_id", orgId);
    const current = (lp ?? []).filter((x) => !x.end_date || new Date(x.end_date) >= today);
    const titles = [...new Set([...STANDARD, ...current.map((x) => x.title)])];
    body = <Table head={["Position", "Held by", "Since"]} rows={titles.map((t) => {
      const holders = current.filter((x) => x.title === t);
      return [t, holders.length ? holders.map((h) => nameOf[h.person_id] ?? "").join("; ") : "Unfilled",
        holders.length ? holders.map((h) => fmtDate(h.start_date + "T12:00:00", { month: "short", year: "numeric" })).join("; ") : ""];
    }).sort((a, b) => (a[1] === "Unfilled" ? 0 : 1) - (b[1] === "Unfilled" ? 0 : 1))} />;
  }

  const title = REPORTS.find(([k]) => k === r)?.[1] ?? "Reports";
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-3 flex-wrap print:hidden">
        <div>
          <h1 className="font-display font-extrabold text-[32px] m-0">Reports</h1>
          <p className="text-[14px] text-smoke m-0 mt-1">Printable lists. Contact details and health status live on their own pages.</p>
        </div>
        <PrintButton />
      </div>
      <nav aria-label="Reports" className="flex gap-x-5 gap-y-1 flex-wrap print:hidden">
        {REPORTS.map(([k, l]) => (
          <Link key={k} href={`/admin/reports?r=${k}`} className="min-h-[40px] flex items-center text-[14px] no-underline"
            style={{ color: k === r ? "#101B2D" : "#4B5568", fontWeight: k === r ? 700 : 500, borderBottom: k === r ? "3px solid #F5B700" : "3px solid transparent" }}>{l}</Link>
        ))}
      </nav>
      <section className="card flex flex-col gap-3">
        <h2 className="font-display font-extrabold text-[22px] m-0">{current.org.name}: {title}</h2>
        <span className="text-[13px] text-smoke">Printed {fmtDate(new Date().toISOString(), { month: "short", day: "numeric", year: "numeric" })}</span>
        {body}
      </section>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  if (!rows.length) return <p className="text-[14px] text-smoke m-0">Nothing to list.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[14px] min-w-[420px]">
        <thead><tr>{head.map((h) => <th key={h} scope="col" className="text-left px-2 py-2 eyebrow text-smoke border-b-2 border-[#DDD6C5]">{h}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => <tr key={i} className="border-b border-[#EAE4D6]">{row.map((c, j) => <td key={j} className="px-2 py-1.5">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

import Link from "next/link";
import { requireOrg } from "@/lib/context";
import Shell from "@/components/Shell";
import { Chip, PageTitle, fmtDate } from "@/components/ui";
import { loadFamily } from "@/lib/family";

// SPEC "Patrol view": members, who leads, and who's going to what. Roster-level info only
// (names, roles); no contact details, payments or health status.
const ROLE: Record<string, string> = { patrol_leader: "Patrol leader", assistant_patrol_leader: "Assistant patrol leader", troop_guide: "Troop guide", den_chief: "Den chief" };

export default async function PatrolsPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const ctx = await requireOrg();
  const { supabase, current, person } = ctx;
  const orgId = current.org.id;

  const [{ data: patrols }, { data: pm }, family, { data: events }] = await Promise.all([
    supabase.from("patrols").select("id, name").eq("org_id", orgId).eq("active", true).order("name"),
    supabase.from("patrol_members").select("patrol_id, person_id, role, persons(first_name, last_name)").eq("org_id", orgId).is("end_date", null),
    loadFamily(supabase, orgId),
    supabase.from("events").select("id, title, start_at").eq("org_id", orgId).eq("canceled", false).gte("start_at", new Date().toISOString()).order("start_at").limit(6),
  ]);
  type M = { patrol_id: string; person_id: string; role: string; persons: { first_name: string; last_name: string } };
  const members = (pm ?? []) as unknown as M[];
  // Default to my own patrol (or my Scout's).
  const mine = new Set([person.id, ...family.map((f) => f.id)]);
  const myPatrol = members.find((m) => mine.has(m.person_id))?.patrol_id;
  const selected = (patrols ?? []).find((x) => x.id === p) ?? (patrols ?? []).find((x) => x.id === myPatrol) ?? (patrols ?? [])[0];
  const roster = members.filter((m) => m.patrol_id === selected?.id)
    .sort((a, b) => (a.role === "member" ? 1 : 0) - (b.role === "member" ? 1 : 0) || a.persons.first_name.localeCompare(b.persons.first_name));
  const ids = roster.map((m) => m.person_id);
  const evIds = (events ?? []).map((e) => e.id);
  const { data: rsvps } = ids.length && evIds.length
    ? await supabase.from("rsvps").select("event_id, person_id, status").in("event_id", evIds).in("person_id", ids)
    : { data: [] as { event_id: string; person_id: string; status: string }[] };

  return (
    <Shell ctx={ctx}>
      <PageTitle title={selected ? `${selected.name} patrol` : "Patrols"} sub="Who's in the patrol and who's coming to what." />
      {(patrols ?? []).length > 1 && (
        <nav aria-label="Patrols" className="flex gap-6 overflow-x-auto border-b-2 border-[#DDD6C5]">
          {(patrols ?? []).map((x) => (
            <Link key={x.id} href={`/patrols?p=${x.id}`} className="min-h-[44px] -mb-[2px] px-0.5 flex items-center border-b-[3px] no-underline text-[15px] whitespace-nowrap"
              style={{ borderColor: x.id === selected?.id ? "#F5B700" : "transparent", color: x.id === selected?.id ? "#101B2D" : "#4B5568", fontWeight: x.id === selected?.id ? 700 : 500 }}>{x.name}</Link>
          ))}
        </nav>
      )}
      {!selected && <div className="card text-smoke">No patrols yet. Leaders set them up under People → Patrols.</div>}
      {selected && (
        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)] items-start">
          <section className="card flex flex-col">
            <span className="text-[12px] font-bold uppercase tracking-widest text-forest mb-2">Members ({roster.length})</span>
            {roster.length === 0 && <span className="text-[14px] text-smoke">Nobody in this patrol yet.</span>}
            {roster.map((m) => (
              <div key={m.person_id} className="flex items-center gap-3 min-h-[52px] border-t border-[#EAE4D6] first:border-0">
                <span className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-[13px] flex-none" style={{ background: "#D7E0EE", color: "#12355F" }}>{m.persons.first_name[0]}{m.persons.last_name[0] ?? ""}</span>
                <span className="flex-1 font-bold text-[15px]">{m.persons.first_name} {m.persons.last_name}</span>
                {m.role !== "member" && <Chip tone="dark">{ROLE[m.role] ?? m.role}</Chip>}
              </div>
            ))}
          </section>
          <section className="card flex flex-col">
            <span className="text-[12px] font-bold uppercase tracking-widest text-forest mb-2">Coming up</span>
            {(events ?? []).length === 0 && <span className="text-[14px] text-smoke">Nothing on the calendar.</span>}
            {(events ?? []).map((e) => {
              const going = roster.filter((m) => (rsvps ?? []).some((r) => r.event_id === e.id && r.person_id === m.person_id && r.status === "going"));
              const noReply = roster.filter((m) => !(rsvps ?? []).some((r) => r.event_id === e.id && r.person_id === m.person_id));
              return (
                <Link key={e.id} href={`/events/${e.id}`} className="flex flex-col gap-1 py-3 border-t border-[#EAE4D6] first:border-0 no-underline text-ink">
                  <div className="flex items-center gap-3">
                    <span className="w-16 font-bold text-forest text-[14px]">{fmtDate(e.start_at, { month: "short", day: "numeric" })}</span>
                    <span className="flex-1 font-bold text-[15px]">{e.title}</span>
                    <Chip tone="green">{going.length} going</Chip>
                  </div>
                  {roster.length > 0 && (
                    <span className="text-[13px] text-smoke pl-[76px]">
                      {going.length ? `Going: ${going.map((m) => m.persons.first_name).join(", ")}` : "Nobody yet"}
                      {noReply.length ? ` · Haven't answered: ${noReply.map((m) => m.persons.first_name).join(", ")}` : ""}
                    </span>
                  )}
                </Link>
              );
            })}
          </section>
        </div>
      )}
    </Shell>
  );
}

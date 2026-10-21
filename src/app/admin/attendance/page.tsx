import Link from "next/link";
import { requireLeader } from "@/lib/context";
import { Chip, PageTitle, Stat } from "@/components/ui";

type Row = { person_id: string; first_name: string; last_name: string; type: string; meetings_held: number; meetings_attended: number; outings_attended: number; nights: number; service_hours: number; miles: number; last_seen: string | null };

export default async function AttendanceReport({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; patrol?: string }> }) {
  const sp = await searchParams;
  const { supabase, current } = await requireLeader();
  const orgId = current.org.id;
  const now = new Date();
  const programStart = new Date(now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1, 7, 1);
  const from = sp.from ?? programStart.toISOString().slice(0, 10);
  const to = sp.to ?? now.toISOString().slice(0, 10);

  const [{ data }, { data: patrols }, { data: pm }, { data: recent }] = await Promise.all([
    supabase.rpc("attendance_summary", { p_org: orgId, p_from: from, p_to: to }),
    supabase.from("patrols").select("id, name").eq("org_id", orgId).eq("active", true).order("name"),
    supabase.from("patrol_members").select("person_id, patrol_id").eq("org_id", orgId).is("end_date", null),
    supabase.from("events").select("id, title, start_at, kind").eq("org_id", orgId).eq("canceled", false).lt("start_at", now.toISOString()).order("start_at", { ascending: false }).limit(12),
  ]);
  const patrolOf = Object.fromEntries((pm ?? []).map((p) => [p.person_id, p.patrol_id]));
  let rows = ((data ?? []) as Row[]);
  if (sp.patrol) rows = rows.filter((r) => patrolOf[r.person_id] === sp.patrol);
  const youth = rows.filter((r) => r.type === "youth");

  const recentIds = (recent ?? []).map((e) => e.id);
  const { data: recentAtt } = recentIds.length ? await supabase.from("attendance").select("event_id, person_id, present").in("event_id", recentIds) : { data: [] };
  const wasThere = (eid: string, pid: string) => (recentAtt ?? []).some((a) => a.event_id === eid && a.person_id === pid && a.present);
  const untaken = (recent ?? []).filter((e) => !(recentAtt ?? []).some((a) => a.event_id === e.id));

  const pct = (r: Row) => (r.meetings_held ? Math.round((Number(r.meetings_attended) / Number(r.meetings_held)) * 100) : null);
  const avg = youth.length ? Math.round(youth.reduce((s, r) => s + (pct(r) ?? 0), 0) / youth.length) : 0;
  const notSeen = youth.filter((r) => !r.last_seen || new Date(r.last_seen).getTime() < Date.now() - 60 * 86400000);

  return (
    <>
      <PageTitle title="Attendance" sub="Meeting and outing attendance with credit toward ranks and merit badges."
        action={<a className="btn-secondary no-underline" href="/api/export/attendance.csv">Export CSV</a>} />

      <form className="card flex gap-2 flex-wrap items-end">
        <label className="flex flex-col gap-1 text-[13px] font-bold">From<input className="input" type="date" name="from" defaultValue={from} /></label>
        <label className="flex flex-col gap-1 text-[13px] font-bold">To<input className="input" type="date" name="to" defaultValue={to} /></label>
        <label className="flex flex-col gap-1 text-[13px] font-bold">Patrol
          <select className="input" name="patrol" defaultValue={sp.patrol ?? ""}><option value="">All</option>{(patrols ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </label>
        <button className="btn-primary">Update</button>
      </form>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Avg meeting attendance" value={`${avg}%`} />
        <Stat label="Nights camped (all Scouts)" value={youth.reduce((s, r) => s + Number(r.nights), 0)} />
        <Stat label="Service hours" value={youth.reduce((s, r) => s + Number(r.service_hours), 0)} />
        <Stat label="Not seen in 60 days" value={notSeen.length} tone={notSeen.length ? "#5E4400" : undefined} />
      </div>

      {untaken.length > 0 && (
        <div className="card flex flex-col gap-2" style={{ background: "#FFF6D6", borderColor: "#F0DA8C" }}>
          <div className="font-bold text-[15px]">Attendance not taken yet</div>
          <div className="flex gap-2 flex-wrap">
            {untaken.map((e) => <Link key={e.id} href={`/events/${e.id}/attendance`} className="btn-secondary no-underline">{e.title} · {new Date(e.start_at).toLocaleDateString()}</Link>)}
          </div>
        </div>
      )}

      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase text-smoke">
              <th className="px-3 py-2">Scout</th><th className="px-2">Meetings</th><th className="px-2">Outings</th><th className="px-2">Nights</th><th className="px-2">Service hrs</th><th className="px-2">Miles</th>
              {(recent ?? []).slice(0, 8).reverse().map((e) => <th key={e.id} className="px-1 text-center" title={e.title}>{new Date(e.start_at).toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const p = pct(r);
              return (
                <tr key={r.person_id} className="border-t border-[#EEE8D9]">
                  <td className="px-3 py-2 font-bold whitespace-nowrap">{r.last_name}, {r.first_name} {r.type === "adult" && <Chip>Adult</Chip>}</td>
                  <td className="px-2">{p === null ? "—" : <Chip tone={p >= 75 ? "green" : p >= 50 ? "orange" : "red"}>{p}%</Chip>}</td>
                  <td className="px-2">{r.outings_attended}</td>
                  <td className="px-2">{r.nights}</td>
                  <td className="px-2">{r.service_hours}</td>
                  <td className="px-2">{r.miles}</td>
                  {(recent ?? []).slice(0, 8).reverse().map((e) => (
                    <td key={e.id} className="px-1 text-center">{wasThere(e.id, r.person_id) ? <span style={{ color: "#12355F", fontWeight: 700 }}>●</span> : <span style={{ color: "#DDD6C5" }}>○</span>}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] text-smoke m-0">
        Under the Guide to Advancement, &ldquo;active&rdquo; for Star, Life and Eagle means registered, not dismissed for disciplinary reasons, and engaged by the unit.
        Low attendance alone can&apos;t be used to deny rank, but these numbers help leaders reach out to Scouts who have drifted away.
      </p>
    </>
  );
}

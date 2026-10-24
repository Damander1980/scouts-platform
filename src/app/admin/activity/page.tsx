import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/context";
import { Chip, TIME_ZONE, fmtDate, fmtTime } from "@/components/ui";

// Plain-language view of the audit log for unit admins: role changes, looks at private details,
// Scoutbook exports and more. The log itself can't be edited (SPEC: Trust and data protection).
type Row = { id: string; actor_id: string | null; action: string; target_type: string | null; payload: Record<string, unknown> | null; created_at: string };

const LABEL: Record<string, string> = {
  "private.viewed": "viewed private member details",
  "membership.created": "added a member",
  "membership.changed": "changed a member's role, admin or leader status",
  "position.assigned": "assigned a position",
  "position.removed": "removed a position",
  "rsvp.set": "changed a sign-up",
  "event.canceled": "canceled an event",
  "dues.charged": "charged yearly dues",
  "badge.approved_to_start": "approved a merit badge to start",
  "form.permission_signed": "signed a permission slip",
  "family.attached": "added a Scout to a family",
  "family.detached": "removed a Scout from a family",
  "child_login.invited": "invited a Scout to their own login",
  "child_login.linked": "linked a Scout's login",
  "deletion.requested": "asked to delete a child's data",
  "deletion.confirmed": "confirmed a deletion request",
  "deletion.canceled": "canceled a deletion request",
  "scoutbook.exported": "downloaded a Scoutbook upload file",
  "person.merged": "merged two duplicate records",
  "scoutbook.connected": "connected Scoutbook sync",
  "scoutbook.disconnected": "turned off Scoutbook sync",
};
const SENSITIVE = new Set(["person.merged", "private.viewed", "membership.changed", "position.assigned", "position.removed", "child_login.invited", "child_login.linked",
  "deletion.requested", "deletion.confirmed", "deletion.canceled", "scoutbook.connected", "scoutbook.disconnected"]);

// First instant of a calendar day (YYYY-MM-DD) in the unit's zone, as an ISO string for the database.
function startOfDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d); // the wanted wall-clock time, as if it were UTC
  const offsetAt = (instant: number) => new Date(new Date(instant).toLocaleString("en-US", { timeZone: TIME_ZONE })).getTime() - new Date(new Date(instant).toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  let t = wall - offsetAt(wall);
  t = wall - offsetAt(t); // settle across a daylight-saving change
  return new Date(t).toISOString();
}

function detail(r: Row) {
  const p = r.payload ?? {};
  if (r.action === "private.viewed" && typeof p.count === "number") return `${p.count} ${p.count === 1 ? "person" : "people"}`;
  if (r.action === "scoutbook.exported") return `${Number(p.items ?? 0) + Number(p.requirements ?? 0)} items`;
  if (r.action === "rsvp.set" && p.to) return `${p.from ?? "no reply"} → ${p.to}`;
  return "";
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ only?: string; from?: string; to?: string; kind?: string; who?: string }> }) {
  const { only, from, to, kind, who } = await searchParams;
  const { supabase, current, isAdmin } = await requireStaff();
  if (!isAdmin) redirect("/admin");
  const day = /^\d{4}-\d{2}-\d{2}$/;
  let q = supabase.from("audit_log").select("id, actor_id, action, target_type, payload, created_at").eq("org_id", current.org.id).order("created_at", { ascending: false }).limit(300);
  if (only === "sensitive") q = q.in("action", [...SENSITIVE]);
  if (from && day.test(from)) q = q.gte("created_at", startOfDay(from));
  if (to && day.test(to)) q = q.lt("created_at", startOfDay(new Date(Date.parse(`${to}T12:00:00Z`) + 86400000).toISOString().slice(0, 10)));
  // Narrow by person in the query itself, so the 300-row cap applies to that person's actions, not to everyone's.
  const whoText = (who ?? "").trim().toLowerCase();
  let whoNone = false;
  if (whoText) {
    const tok = whoText.split(/s+/)[0].replace(/[^a-z0-9'-]/g, "");
    const { data: cands } = tok ? await supabase.from("persons").select("id, first_name, last_name").or(`first_name.ilike.%${tok}%,last_name.ilike.%${tok}%`).limit(200) : { data: [] };
    const hit = ((cands ?? []) as { id: string; first_name: string; last_name: string }[]).filter((c) => `${c.first_name} ${c.last_name}`.toLowerCase().includes(whoText)).map((c) => c.id);
    if (hit.length) q = q.in("actor_id", hit); else whoNone = true;
  }
  // "kind" is the first part of an action name, e.g. membership, rsvp, event, form.
  if (kind && /^[a-z_]+$/.test(kind)) q = q.like("action", `${kind}.%`);
  const { data } = whoNone ? { data: [] } : await q;
  const rows = (data ?? []) as Row[];
  const ids = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[];
  const { data: names } = ids.length ? await supabase.rpc("person_names", { p_ids: ids }) : { data: [] };
  const nameOf = Object.fromEntries(((names ?? []) as { id: string; first_name: string; last_name: string }[]).map((n) => [n.id, `${n.first_name} ${n.last_name}`]));
  const kinds = [...new Set((data ?? []).map((r) => String(r.action).split(".")[0]))].sort();
  const filtered = !!(from || to || kind || who?.trim());

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display font-extrabold text-[32px] m-0">Activity log</h1>
          <p className="text-[14px] text-smoke m-0 mt-1">Who did what, most recent first. Entries can&apos;t be edited or deleted.</p>
        </div>
        <div className="flex gap-4 text-[14px] font-bold">
          <a href="/admin/activity" className="text-forest min-h-[44px] flex items-center" style={{ textDecoration: only ? "none" : "underline" }}>Everything</a>
          <a href="/admin/activity?only=sensitive" className="text-forest min-h-[44px] flex items-center" style={{ textDecoration: only ? "underline" : "none" }}>Privacy and access only</a>
        </div>
      </div>
      <form method="get" className="card flex items-end gap-3 flex-wrap">
        {only && <input type="hidden" name="only" value={only} />}
        <label className="flex flex-col gap-1 text-[13px] font-bold">From<input type="date" name="from" defaultValue={from ?? ""} className="input h-10 min-h-0" /></label>
        <label className="flex flex-col gap-1 text-[13px] font-bold">To<input type="date" name="to" defaultValue={to ?? ""} className="input h-10 min-h-0" /></label>
        <label className="flex flex-col gap-1 text-[13px] font-bold">Type
          <select name="kind" defaultValue={kind ?? ""} className="input h-10 min-h-0 w-auto">
            <option value="">Everything</option>
            {kinds.map((k) => <option key={k} value={k}>{k.replace(/_/g, " ")}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-bold flex-1 min-w-[160px]">Who<input name="who" defaultValue={who ?? ""} placeholder="Name" className="input h-10 min-h-0" /></label>
        <button className="btn-primary">Filter</button>
        {filtered && <a href="/admin/activity" className="btn-ghost no-underline">Clear</a>}
      </form>
      {rows.length === 0 && <div className="card text-smoke">{filtered ? "Nothing matches those filters." : "Nothing recorded yet."}</div>}
      {rows.length > 0 && (
        <div className="card p-0 overflow-hidden">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-5 py-3 border-b border-[#EAE4D6] last:border-0 flex-wrap text-[14px]">
              <span className="w-36 text-smoke flex-none">{fmtDate(r.created_at, { month: "short", day: "numeric" })} · {fmtTime(r.created_at)}</span>
              <span className="flex-1 min-w-[220px]"><b>{r.actor_id ? nameOf[r.actor_id] ?? "A member" : "System"}</b> {LABEL[r.action] ?? r.action.replace(/[._]/g, " ")}</span>
              {detail(r) && <span className="text-smoke">{detail(r)}</span>}
              {SENSITIVE.has(r.action) && <Chip tone="orange">Privacy</Chip>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

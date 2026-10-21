import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/context";
import { Chip, fmtDate, fmtTime } from "@/components/ui";

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
  "scoutbook.connected": "connected Scoutbook sync",
  "scoutbook.disconnected": "turned off Scoutbook sync",
};
const SENSITIVE = new Set(["private.viewed", "membership.changed", "position.assigned", "position.removed", "child_login.invited", "child_login.linked",
  "deletion.requested", "deletion.confirmed", "deletion.canceled", "scoutbook.connected", "scoutbook.disconnected"]);

function detail(r: Row) {
  const p = r.payload ?? {};
  if (r.action === "private.viewed" && typeof p.count === "number") return `${p.count} ${p.count === 1 ? "person" : "people"}`;
  if (r.action === "scoutbook.exported") return `${Number(p.items ?? 0) + Number(p.requirements ?? 0)} items`;
  if (r.action === "rsvp.set" && p.to) return `${p.from ?? "no reply"} → ${p.to}`;
  return "";
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ only?: string }> }) {
  const { only } = await searchParams;
  const { supabase, current, isAdmin } = await requireStaff();
  if (!isAdmin) redirect("/admin");
  let q = supabase.from("audit_log").select("id, actor_id, action, target_type, payload, created_at").eq("org_id", current.org.id).order("created_at", { ascending: false }).limit(300);
  if (only === "sensitive") q = q.in("action", [...SENSITIVE]);
  const { data } = await q;
  const rows = (data ?? []) as Row[];
  const ids = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[];
  const { data: names } = ids.length ? await supabase.rpc("person_names", { p_ids: ids }) : { data: [] };
  const nameOf = Object.fromEntries(((names ?? []) as { id: string; first_name: string; last_name: string }[]).map((n) => [n.id, `${n.first_name} ${n.last_name}`]));

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
      {rows.length === 0 && <div className="card text-smoke">Nothing recorded yet.</div>}
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

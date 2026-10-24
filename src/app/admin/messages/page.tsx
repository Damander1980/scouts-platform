import Link from "next/link";
import { requireStaff } from "@/lib/context";
import { Chip, PageTitle, fmtStamp } from "@/components/ui";

export default async function MessageLogPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { supabase, current, isAdmin } = await requireStaff();
  const orgId = current.org.id;
  // Every leader who can read the full log is recorded opening it (the database ignores everyone else).
  await supabase.rpc("log_message_view", { p_org: orgId });

  let query = supabase.from("message_log").select("id, sender_id, subject, body, audience, created_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(200);
  if (q) query = query.or(`subject.ilike.%${q.replace(/[%,()]/g, "")}%,body.ilike.%${q.replace(/[%,()]/g, "")}%`);
  const [{ data: msgs }, { data: views }, { data: deliveries }] = await Promise.all([
    query,
    supabase.from("message_log_views").select("viewer_id, viewed_at").eq("org_id", orgId).order("viewed_at", { ascending: false }).limit(20),
    supabase.from("message_deliveries").select("message_id, delivered, skipped, full_email"),
  ]);
  const ids = [...new Set([...(msgs ?? []).map((m) => m.sender_id), ...(views ?? []).map((v) => v.viewer_id)].filter(Boolean))] as string[];
  const { data: names } = ids.length ? await supabase.rpc("person_names", { p_ids: ids }) : { data: [] };
  const nameOf = Object.fromEntries(((names ?? []) as { id: string; first_name: string; last_name: string; type: string }[]).map((n) => [n.id, n]));
  const del = Object.fromEntries((deliveries ?? []).map((d) => [d.message_id, d]));

  return (
    <>
      <PageTitle title="Message log" sub="Every message in the unit, permanent and unedited, so you can check exactly what was said if a concern is ever raised. Opening this log is recorded." />
      {!isAdmin && <div className="card">Unit admins and designated leaders with current Youth Protection Training see the full log; everyone else sees messages they sent or received.</div>}
      <form className="flex gap-2"><input aria-label="Search messages" name="q" defaultValue={q ?? ""} className="input flex-1" placeholder="Search messages" /><button className="btn-secondary">Search</button></form>
      <div className="flex flex-col gap-2">
        {(msgs ?? []).map((m) => {
          const s = m.sender_id ? nameOf[m.sender_id] : null;
          const d = del[m.id];
          return (
            <Link key={m.id} href={`/messages/${m.id}`} className="card flex flex-col gap-1 no-underline text-ink">
              <div className="flex items-center gap-2 flex-wrap text-[14px]">
                <b>{s ? `${s.first_name} ${s.last_name}` : "Member"}</b>{s?.type === "youth" && <Chip tone="orange">Youth sender</Chip>}
                <Chip>{m.audience}</Chip>
                {d && <Chip tone={d.full_email ? "green" : "gray"}>{d.full_email ? `Emailed ${d.delivered}` : "In-app"}</Chip>}
                <span className="ml-auto text-[12px] text-smoke">{fmtStamp(m.created_at)}</span>
              </div>
              {m.subject && <div className="font-bold">{m.subject}</div>}
              <div className="text-[14px] text-smoke line-clamp-2">{m.body}</div>
            </Link>
          );
        })}
      </div>
      {isAdmin && (views ?? []).length > 0 && (
        <details className="card"><summary className="font-bold cursor-pointer">Who has opened this log</summary>
          <div className="flex flex-col gap-1 mt-2 text-[13px]">
            {(views ?? []).map((v, i) => <div key={i}>{v.viewer_id ? `${nameOf[v.viewer_id]?.first_name ?? ""} ${nameOf[v.viewer_id]?.last_name ?? ""}` : "Admin"} · {fmtStamp(v.viewed_at)}</div>)}
          </div>
        </details>
      )}
    </>
  );
}

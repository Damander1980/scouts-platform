import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/context";
import Shell from "@/components/Shell";
import { Chip, fmtDate, fmtTime } from "@/components/ui";
import ReplyBox from "./ReplyBox";

const AUDIENCE: Record<string, string> = {
  troop: "Whole unit", patrol: "Patrol", event: "Everyone going to an event", nonresponders: "Families who hadn't replied",
  people: "Selected people", leaders: "Leaders", reply: "Reply to group",
};

export default async function MessagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrg();
  const { supabase, person, current, isAdmin } = ctx;

  const { data: msg } = await supabase.from("message_log").select("*").eq("id", id).maybeSingle();
  if (!msg || msg.org_id !== current.org.id) notFound();
  const rootId = msg.parent_id ?? msg.id;

  const [{ data: thread }, { data: mine }] = await Promise.all([
    supabase.from("message_log").select("id, sender_id, body, subject, created_at, audience").or(`id.eq.${rootId},parent_id.eq.${rootId}`).order("created_at"),
    supabase.from("message_recipients").select("message_id, read_at").eq("person_id", person.id),
  ]);
  const visible = (thread ?? []);
  const iReceived = (mine ?? []).some((r) => r.message_id === id);
  if (!iReceived && isAdmin) await supabase.rpc("log_message_view", { p_org: current.org.id });

  const unreadIds = (mine ?? []).filter((r) => !r.read_at && visible.some((v) => v.id === r.message_id)).map((r) => r.message_id);
  if (unreadIds.length) await supabase.from("message_recipients").update({ read_at: new Date().toISOString() }).eq("person_id", person.id).in("message_id", unreadIds);

  const { data: recips } = await supabase.from("message_recipients").select("person_id, copy_reason").eq("message_id", rootId);
  const ids = [...new Set([...visible.map((v) => v.sender_id), ...(recips ?? []).map((r) => r.person_id)].filter(Boolean))] as string[];
  const { data: names } = await supabase.rpc("person_names", { p_ids: ids });
  const nameOf = Object.fromEntries(((names ?? []) as { id: string; first_name: string; last_name: string }[]).map((n) => [n.id, `${n.first_name} ${n.last_name}`]));

  const direct = (recips ?? []).filter((r) => r.copy_reason === "direct");
  const copies = (recips ?? []).filter((r) => r.copy_reason === "parent_copy" || r.copy_reason === "leader_copy");

  return (
    <Shell ctx={ctx}>
      <Link href="/messages" className="text-[13px] font-bold text-forest no-underline">← Messages</Link>
      <div className="flex flex-col gap-1">
        <h1 className="font-display font-extrabold text-[24px] leading-tight m-0">{visible[0]?.subject ?? msg.subject ?? "Message"}</h1>
        <div className="text-[13px] text-smoke">
          To: {AUDIENCE[visible[0]?.audience ?? ""] ?? "Group"} · {direct.length} people
          {copies.length > 0 && ` · copied to ${copies.length} parents/leaders for youth protection`}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {visible.map((m) => (
          <div key={m.id} className="card flex flex-col gap-2" style={m.sender_id === person.id ? { background: "#F8F5EE" } : undefined}>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[15px]">{m.sender_id ? nameOf[m.sender_id] ?? "Member" : "System"}</span>
              {m.sender_id === person.id && <Chip>You</Chip>}
              <span className="ml-auto text-[12px] text-smoke">{fmtDate(m.created_at)} {fmtTime(m.created_at)}</span>
            </div>
            <div className="text-[15px] whitespace-pre-wrap">{m.body}</div>
          </div>
        ))}
      </div>

      <details className="card">
        <summary className="text-[14px] font-bold cursor-pointer">Who received this</summary>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {(recips ?? []).filter((r) => r.copy_reason !== "sender").map((r) => (
            <Chip key={r.person_id} tone={r.copy_reason === "direct" ? "green" : "gray"}>
              {nameOf[r.person_id] ?? "Member"}{r.copy_reason === "parent_copy" ? " (parent copy)" : r.copy_reason === "leader_copy" ? " (leader copy)" : ""}
            </Chip>
          ))}
        </div>
      </details>

      {iReceived && <ReplyBox orgId={current.org.id} messageId={id} />}
    </Shell>
  );
}

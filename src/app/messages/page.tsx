import Link from "next/link";
import { requireOrg } from "@/lib/context";
import Shell from "@/components/Shell";
import { Chip, Empty, LinkButton, PageTitle, fmtDate, fmtTime } from "@/components/ui";

type Row = {
  read_at: string | null; copy_reason: string | null;
  message_log: { id: string; org_id: string; subject: string | null; body: string; sender_id: string | null; created_at: string; audience: string | null } | null;
};

const REASON: Record<string, string> = { parent_copy: "Copy: your child", leader_copy: "Copy: leader", sender: "Sent" };

export default async function MessagesPage() {
  const ctx = await requireOrg();
  const { supabase, person, current } = ctx;

  const { data } = await supabase.from("message_recipients")
    .select("read_at, copy_reason, message_log(id, org_id, subject, body, sender_id, created_at, audience)")
    .eq("person_id", person.id).order("message_id", { ascending: false }).limit(200);
  const rows = ((data ?? []) as unknown as Row[])
    .filter((r) => r.message_log && r.message_log.org_id === current.org.id)
    .sort((a, b) => b.message_log!.created_at.localeCompare(a.message_log!.created_at));

  const senderIds = [...new Set(rows.map((r) => r.message_log!.sender_id).filter(Boolean))] as string[];
  const { data: names } = senderIds.length ? await supabase.rpc("person_names", { p_ids: senderIds }) : { data: [] };
  const nameOf = Object.fromEntries(((names ?? []) as { id: string; first_name: string; last_name: string }[]).map((n) => [n.id, `${n.first_name} ${n.last_name}`]));

  return (
    <Shell ctx={ctx}>
      <PageTitle title="Messages" sub="Every message is saved and can't be edited or deleted. Messages to Scouts always copy their parents and leaders."
        action={<div className="flex gap-2"><LinkButton href="/forum" variant="secondary">Discussion boards</LinkButton><LinkButton href="/messages/new">New message</LinkButton></div>} />
      {rows.length === 0 && <Empty>No messages yet.</Empty>}
      {rows.length > 0 && <div className="card p-0 overflow-hidden flex flex-col">
        {rows.map((r) => {
          const m = r.message_log!;
          const unread = !r.read_at;
          return (
            <Link key={m.id} href={`/messages/${m.id}`} className="flex flex-col gap-1 px-5 py-3.5 no-underline text-ink border-b border-[#EAE4D6] last:border-0"
              style={{ background: unread ? "#FFFFFF" : "#FBF9F4" }}>
              <div className="flex items-center gap-2">
                {unread && <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: "#F5B700" }} aria-label="Unread" />}
                <span className={`text-[15px] ${unread ? "font-bold" : ""}`}>{m.sender_id ? nameOf[m.sender_id] ?? "Member" : "System"}</span>
                {r.copy_reason && REASON[r.copy_reason] && <Chip>{REASON[r.copy_reason]}</Chip>}
                <span className="ml-auto text-[12px] text-smoke">{fmtDate(m.created_at, { month: "short", day: "numeric" })} {fmtTime(m.created_at)}</span>
              </div>
              {m.subject && <div className={`text-[15px] ${unread ? "font-bold" : ""}`}>{m.subject}</div>}
              <div className="text-[14px] text-smoke line-clamp-2">{m.body}</div>
            </Link>
          );
        })}
      </div>}
    </Shell>
  );
}

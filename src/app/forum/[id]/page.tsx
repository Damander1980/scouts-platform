import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/context";
import Shell from "@/components/Shell";
import { Chip, fmtDate, fmtTime } from "@/components/ui";
import TopicClient from "./TopicClient";

export default async function TopicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrg();
  const { supabase, current, person } = ctx;
  const { data: t } = await supabase.from("forum_topics").select("id, title, audience, locked, pinned, created_at").eq("id", id).eq("org_id", current.org.id).maybeSingle();
  if (!t) notFound();
  const [{ data: posts }, { data: ms }] = await Promise.all([
    supabase.from("forum_posts").select("id, author_id, body, created_at").eq("topic_id", id).order("created_at"),
    supabase.from("memberships").select("person_id, persons(first_name, last_name, nickname, type)").eq("org_id", current.org.id),
  ]);
  const who = Object.fromEntries(((ms ?? []) as unknown as { person_id: string; persons: { first_name: string; last_name: string; nickname: string | null; type: string } }[])
    .filter((m) => m.persons)
    .map((m) => [m.person_id, { name: `${m.persons.nickname || m.persons.first_name} ${m.persons.last_name}`, youth: m.persons.type === "youth" }]));
  const canModerate = ctx.isLeader || ctx.isAdmin;

  return (
    <Shell ctx={ctx}>
      <Link href="/forum" className="text-[13px] font-bold text-forest no-underline">← Discussion boards</Link>
      <div>
        <h1 className="font-display font-extrabold text-[26px] m-0">{t.title}</h1>
        <div className="flex gap-1.5 mt-1">
          {t.audience === "adults" ? <Chip tone="dark">Adults only</Chip> : <Chip>Everyone</Chip>}
          {t.pinned && <Chip tone="orange">Pinned</Chip>}
          {t.locked && <Chip tone="red">Locked</Chip>}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {(posts ?? []).map((p) => (
          <div key={p.id} className="card flex flex-col gap-1">
            <div className="flex gap-2 items-center text-[13px]">
              <b>{who[p.author_id]?.name ?? "Former member"}</b>
              {who[p.author_id]?.youth && <Chip>Scout</Chip>}
              <span className="text-smoke">{fmtDate(p.created_at)} {fmtTime(p.created_at)}</span>
            </div>
            <div className="text-[15px] whitespace-pre-wrap">{p.body}</div>
          </div>
        ))}
      </div>
      <TopicClient topicId={t.id} orgId={current.org.id} personId={person.id} locked={t.locked} pinned={t.pinned} canModerate={canModerate} />
    </Shell>
  );
}

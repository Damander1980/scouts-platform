import Link from "next/link";
import { requireOrg } from "@/lib/context";
import Shell from "@/components/Shell";
import { Chip, Empty, PageTitle, fmtDate } from "@/components/ui";
import NewTopic from "./NewTopic";

export default async function ForumPage() {
  const ctx = await requireOrg();
  const { supabase, current, person } = ctx;
  const orgId = current.org.id;
  // Post counts come back with the topics (counted in the database, not by loading every post).
  const { data: topics } = await supabase.from("forum_topics").select("id, title, audience, locked, pinned, last_post_at, created_by, forum_posts(count)").eq("org_id", orgId)
    .order("pinned", { ascending: false }).order("last_post_at", { ascending: false }).limit(100);
  const count = (t: { forum_posts?: { count: number }[] | null }) => t.forum_posts?.[0]?.count ?? 0;

  return (
    <Shell ctx={ctx}>
      <Link href="/messages" className="text-[13px] font-bold text-forest no-underline">← Messages</Link>
      <PageTitle title="Discussion boards" sub="Group conversations for the whole unit. Posts are saved and can't be edited or deleted. Scouts only see boards open to everyone, which every parent and leader can read too." />
      <NewTopic orgId={orgId} personId={person.id} isAdult={person.type === "adult"} />
      {!topics?.length && <Empty>No conversations yet. Start one above.</Empty>}
      <div className="flex flex-col gap-2">
        {(topics ?? []).map((t) => (
          <Link key={t.id} href={`/forum/${t.id}`} className="card flex flex-col gap-1 no-underline text-ink">
            <div className="font-bold text-[16px]">{t.title}</div>
            <div className="flex gap-1.5 flex-wrap items-center text-[13px] text-smoke">
              {t.pinned && <Chip tone="orange">Pinned</Chip>}
              {t.audience === "adults" ? <Chip tone="dark">Adults only</Chip> : <Chip>Everyone</Chip>}
              {t.locked && <Chip tone="red">Locked</Chip>}
              <span>{count(t)} post{count(t) === 1 ? "" : "s"} · last {fmtDate(t.last_post_at)}</span>
            </div>
          </Link>
        ))}
      </div>
    </Shell>
  );
}

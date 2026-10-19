import Link from "next/link";
import { requireOrg } from "@/lib/context";
import Shell from "@/components/Shell";
import { Chip, Empty, PageTitle, fmtDate } from "@/components/ui";
import NewTopic from "./NewTopic";

export default async function ForumPage() {
  const ctx = await requireOrg();
  const { supabase, current, person } = ctx;
  const orgId = current.org.id;
  const [{ data: topics }, { data: me }] = await Promise.all([
    supabase.from("forum_topics").select("id, title, audience, locked, pinned, last_post_at, created_by").eq("org_id", orgId)
      .order("pinned", { ascending: false }).order("last_post_at", { ascending: false }).limit(100),
    supabase.from("persons").select("type").eq("id", person.id).maybeSingle(),
  ]);
  const ids = (topics ?? []).map((t) => t.id);
  const { data: posts } = ids.length ? await supabase.from("forum_posts").select("topic_id").in("topic_id", ids) : { data: [] as { topic_id: string }[] };
  const count = (id: string) => (posts ?? []).filter((p) => p.topic_id === id).length;

  return (
    <Shell ctx={ctx}>
      <Link href="/messages" className="text-[13px] font-bold text-forest no-underline">← Messages</Link>
      <PageTitle title="Discussion boards" sub="Group conversations for the whole unit. Posts are saved and can't be edited or deleted. Scouts only see boards open to everyone, which every parent and leader can read too." />
      <NewTopic orgId={orgId} personId={person.id} isAdult={me?.type === "adult"} />
      {!topics?.length && <Empty>No conversations yet. Start one above.</Empty>}
      <div className="flex flex-col gap-2">
        {(topics ?? []).map((t) => (
          <Link key={t.id} href={`/forum/${t.id}`} className="card flex flex-col gap-1 no-underline text-ink">
            <div className="font-bold text-[16px]">{t.title}</div>
            <div className="flex gap-1.5 flex-wrap items-center text-[13px] text-smoke">
              {t.pinned && <Chip tone="orange">Pinned</Chip>}
              {t.audience === "adults" ? <Chip tone="dark">Adults only</Chip> : <Chip>Everyone</Chip>}
              {t.locked && <Chip tone="red">Locked</Chip>}
              <span>{count(t.id)} post{count(t.id) === 1 ? "" : "s"} · last {fmtDate(t.last_post_at)}</span>
            </div>
          </Link>
        ))}
      </div>
    </Shell>
  );
}

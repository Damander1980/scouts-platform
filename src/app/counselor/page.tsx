import Link from "next/link";
import { requireOrg } from "@/lib/context";
import Shell from "@/components/Shell";
import { Chip, Empty, PageTitle, SectionLabel } from "@/components/ui";
import CounselorSign from "./CounselorSign";

export default async function CounselorPage() {
  const ctx = await requireOrg();
  const { supabase, current, person } = ctx;
  const orgId = current.org.id;
  const [{ data: mine }, { data: queue }, { data: badges }] = await Promise.all([
    supabase.rpc("my_counselees", { p_org: orgId }),
    supabase.rpc("signoff_queue", { p_org: orgId }),
    supabase.from("merit_badge_counselors").select("advancement_items(id, name)").eq("org_id", orgId).eq("person_id", person.id),
  ]);
  const myBadges = ((badges ?? []) as unknown as { advancement_items: { id: string; name: string } }[]).map((b) => b.advancement_items);
  const ids = new Set(myBadges.map((b) => b.id));
  const myQueue = ((queue ?? []) as { progress_id: string; person_id: string; scout: string; item: string; item_id: string; number: string; requirement: string; can_sign: boolean }[])
    .filter((q) => ids.has(q.item_id) && q.can_sign);

  return (
    <Shell ctx={ctx}>
      <PageTitle title="Merit badge counselor" sub="Scouts assigned to you and requirements waiting for your sign-off." />
      <div className="card text-[14px]" style={{ background: "#FFF1E6", borderColor: "#FFD6B8" }}>
        <b>Youth protection:</b> every meeting with a Scout needs a buddy present (another Scout, a parent, or a second registered adult), and online meetings
        must include another adult or the parent. No one-on-one contact, in person or online.
      </div>

      <section className="flex flex-col gap-2">
        <SectionLabel>Badges you counsel</SectionLabel>
        <div className="flex gap-1.5 flex-wrap">{myBadges.length ? myBadges.map((b) => <Chip key={b.id} tone="green">{b.name}</Chip>) : <span className="text-smoke">None yet. A unit admin assigns them on the Members page.</span>}</div>
      </section>

      <section className="flex flex-col gap-2">
        <SectionLabel>Waiting for you ({myQueue.length})</SectionLabel>
        {myQueue.length === 0 && <Empty>Nothing to sign right now.</Empty>}
        {myQueue.map((q) => (
          <div key={q.progress_id} className="card flex items-start gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="font-bold">{q.scout} · {q.item} #{q.number}</div>
              <div className="text-[14px] text-smoke">{q.requirement}</div>
            </div>
            <CounselorSign progressId={q.progress_id} />
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <SectionLabel>Your Scouts</SectionLabel>
        {(mine ?? []).length === 0 && <Empty>No Scouts assigned to you yet.</Empty>}
        {((mine ?? []) as { adv_id: string; scout_id: string; scout_name: string; badge: string; status: string }[]).map((m) => (
          <Link key={m.adv_id} href={`/scout/${m.scout_id}/advancement`} className="card flex items-center gap-2 no-underline text-ink">
            <b>{m.scout_name}</b><span>{m.badge}</span><Chip tone={m.status === "completed" ? "green" : "orange"}>{m.status === "completed" ? "Earned" : "In progress"}</Chip>
          </Link>
        ))}
      </section>
    </Shell>
  );
}

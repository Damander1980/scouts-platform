import Link from "next/link";
import { requirePerm } from "@/lib/context";
import { SKILLS } from "@/lib/skills";
import { Chip } from "@/components/ui";

// Leader view of the adult skills inventory. ?skill= filters to one skill; ?drive=1 to drivers.
export default async function SkillsPage({ searchParams }: { searchParams: Promise<{ skill?: string; drive?: string }> }) {
  const { skill, drive } = await searchParams;
  const { supabase, current } = await requirePerm("leader", "volunteer.manage");
  const orgId = current.org.id;
  const [{ data: rows }, { data: ms }] = await Promise.all([
    supabase.from("adult_skills").select("person_id, skills, other, can_drive, updated_at").eq("org_id", orgId),
    supabase.from("memberships").select("person_id, persons(first_name, last_name, type)").eq("org_id", orgId).eq("status", "active"),
  ]);
  const people = (ms ?? []) as unknown as { person_id: string; persons: { first_name: string; last_name: string; type: string } }[];
  const nameOf = Object.fromEntries(people.map((m) => [m.person_id, `${m.persons.first_name} ${m.persons.last_name}`]));
  const all = (rows ?? []).filter((r) => nameOf[r.person_id]);
  const shown = all.filter((r) => (!skill || r.skills.includes(skill)) && (!drive || r.can_drive))
    .sort((a, b) => nameOf[a.person_id].localeCompare(nameOf[b.person_id]));
  const count = (s: string) => all.filter((r) => r.skills.includes(s)).length;
  const adults = people.filter((p) => p.persons.type === "adult").length;

  const pill = (href: string, label: string, on: boolean) => (
    <Link key={href} href={href} className="px-3 py-2 rounded-full text-[13px] font-bold border no-underline"
      style={{ background: on ? "#12355F" : "white", color: on ? "white" : "#4B5568", borderColor: on ? "#12355F" : "#DDD6C5" }}>{label}</Link>
  );

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/volunteer" className="text-[13px] font-bold text-forest no-underline">← Volunteers & polls</Link>
      <div>
        <h1 className="font-display font-extrabold text-[32px] m-0">Parent and leader skills</h1>
        <p className="text-[14px] text-smoke m-0 mt-1">{all.length} of {adults} adults have filled this in. Adults add their skills under Settings.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {pill("/admin/volunteer/skills", "Everyone", !skill && !drive)}
        {pill("/admin/volunteer/skills?drive=1", `Can drive (${all.filter((r) => r.can_drive).length})`, !!drive)}
        {SKILLS.filter((s) => count(s) > 0).map((s) => pill(`/admin/volunteer/skills?skill=${encodeURIComponent(s)}`, `${s} (${count(s)})`, skill === s))}
      </div>
      {shown.length === 0 && <div className="card text-smoke">Nobody yet. Ask adults to add what they can help with under Settings.</div>}
      {shown.map((r) => (
        <div key={r.person_id} className="card flex flex-col gap-1">
          <div className="font-bold text-[15px]">{nameOf[r.person_id]} {r.can_drive && <Chip tone="green">Can drive</Chip>}</div>
          <div className="flex flex-wrap gap-1">{r.skills.map((s: string) => <Chip key={s}>{s}</Chip>)}</div>
          {r.other && <div className="text-[13px] text-smoke">{r.other}</div>}
        </div>
      ))}
    </div>
  );
}

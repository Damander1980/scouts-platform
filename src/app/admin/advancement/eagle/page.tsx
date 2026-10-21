import Link from "next/link";
import { requireLeader } from "@/lib/context";
import EagleClient, { type Project } from "./EagleClient";

export default async function EagleProjectsPage() {
  const { supabase, current } = await requireLeader();
  const orgId = current.org.id;
  const [projects, { data: members }] = await Promise.all([
    supabase.from("eagle_projects").select("*").eq("org_id", orgId),
    supabase.from("memberships").select("person_id, role, persons(first_name, last_name, type)").eq("org_id", orgId).eq("status", "active"),
  ]);
  type M = { person_id: string; role: string; persons: { first_name: string; last_name: string; type: string } };
  const ms = (members ?? []) as unknown as M[];
  const name = (m: M) => `${m.persons.first_name} ${m.persons.last_name}`;
  return (
    <div className="flex flex-col gap-5">
      <Link href="/admin/advancement" className="text-[14px] font-bold text-forest no-underline min-h-[32px] flex items-center">← Advancement</Link>
      <div>
        <h1 className="font-display font-extrabold text-[32px] m-0">Eagle projects</h1>
        <p className="text-[14px] text-smoke m-0 mt-1">Each Life Scout&apos;s service project, from proposal approvals to the board of review, in workbook order.</p>
      </div>
      {projects.error
        ? <div className="card text-smoke">Eagle project tracking turns on once the latest database update is applied.</div>
        : <EagleClient orgId={orgId} projects={(projects.data ?? []) as Project[]}
            scouts={ms.filter((m) => m.persons.type === "youth").map((m) => ({ id: m.person_id, name: name(m) })).sort((a, b) => a.name.localeCompare(b.name))}
            adults={ms.filter((m) => m.persons.type === "adult").map((m) => ({ id: m.person_id, name: name(m) })).sort((a, b) => a.name.localeCompare(b.name))} />}
    </div>
  );
}

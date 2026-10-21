import Link from "next/link";
import { requirePerm } from "@/lib/context";
import BulkClient, { type Row } from "./BulkClient";

// "Update all": one grid for swim tests, shirt sizes, YPT and registration dates, like
// TroopWebHost's Update All screens. Health form status stays on Safety → Health forms,
// where only designated leaders record it.
export default async function BulkPage() {
  const { supabase, current, isAdmin } = await requirePerm("members.manage", "leader");
  const { data } = await supabase.from("memberships")
    .select("id, ypt_expires, registration_expires, swim_class, uniform_size, persons(first_name, last_name, type)")
    .eq("org_id", current.org.id).eq("status", "active");
  const rows = ((data ?? []) as unknown as (Omit<Row, "name" | "type"> & { persons: { first_name: string; last_name: string; type: string } })[])
    .map((m) => ({ id: m.id, ypt_expires: m.ypt_expires, registration_expires: m.registration_expires, swim_class: m.swim_class, uniform_size: m.uniform_size,
      name: `${m.persons.last_name}, ${m.persons.first_name}`, type: m.persons.type }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="flex flex-col gap-5">
      <Link href="/admin/members" className="text-[14px] font-bold text-forest no-underline min-h-[32px] flex items-center">← Members</Link>
      <div>
        <h1 className="font-display font-extrabold text-[32px] m-0">Update all</h1>
        <p className="text-[14px] text-smoke m-0 mt-1">Edit swim tests, shirt sizes and adult training dates for everyone at once. Each change saves when you leave the box.</p>
      </div>
      <BulkClient rows={rows} canEdit={isAdmin} />
    </div>
  );
}

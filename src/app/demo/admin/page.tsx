import AdminLayoutClient from "@/app/admin/AdminLayoutClient";
import MembersClient from "@/app/admin/members/MembersClient";
import { createClient } from "@/lib/supabase/server";

const fakeOrg = { id: "1", name: "Troop 999", type: "scouts_bsa", unit_number: "999", city: "Plano, TX", join_code: "TRP999PL" };
const fakePerson = { id: "1", first_name: "Floyd", last_name: "Kobler" };

const fakeMembers = [
  { id: "m1", role: "scoutmaster", status: "active", joined_at: "2024-01-01", ypt_expires: "2026-03-01",
    persons: { id: "p1", first_name: "Floyd", last_name: "Kobler", type: "adult", birthdate: null, user_id: "u1" } },
  { id: "m2", role: "assistant_scoutmaster", status: "active", joined_at: "2024-02-10", ypt_expires: "2025-06-01",
    persons: { id: "p2", first_name: "Sarah", last_name: "Mitchell", type: "adult", birthdate: null, user_id: "u2" } },
  { id: "m3", role: "parent_guardian", status: "active", joined_at: "2024-03-05", ypt_expires: null,
    persons: { id: "p3", first_name: "Tom", last_name: "Garcia", type: "adult", birthdate: null, user_id: null } },
  { id: "m4", role: "scout", status: "active", joined_at: "2024-03-05", ypt_expires: null,
    persons: { id: "p4", first_name: "Jake", last_name: "Garcia", type: "youth", birthdate: "2012-05-14", user_id: null } },
  { id: "m5", role: "scout", status: "active", joined_at: "2024-04-01", ypt_expires: null,
    persons: { id: "p5", first_name: "Emma", last_name: "Chen", type: "youth", birthdate: "2011-09-22", user_id: null } },
  { id: "m6", role: "scout", status: "inactive", joined_at: "2023-09-01", ypt_expires: null,
    persons: { id: "p6", first_name: "Liam", last_name: "Johnson", type: "youth", birthdate: "2012-01-30", user_id: null } },
  { id: "m7", role: "merit_badge_counselor", status: "active", joined_at: "2024-05-01", ypt_expires: "2027-01-15",
    persons: { id: "p7", first_name: "Dana", last_name: "Brooks", type: "adult", birthdate: null, user_id: "u7" } },
];

export default async function DemoAdminPage() {
  const supabase = await createClient();
  const { data: badges } = await supabase.from("advancement_items").select("id, name, eagle_required, code").eq("kind", "badge").order("name");
  const pick = (code: string) => badges?.find((b) => b.code === code)?.id;
  const assignments = ["first_aid", "camping", "swimming"].map((c) => pick(c)).filter(Boolean)
    .map((id) => ({ person_id: "p7", item_id: id as string }));

  return (
    <AdminLayoutClient person={fakePerson} org={fakeOrg} role="scoutmaster">
      <MembersClient members={fakeMembers as any} orgId="1" myRole="scoutmaster"
        badges={badges ?? []} counselorAssignments={assignments} demo />
    </AdminLayoutClient>
  );
}

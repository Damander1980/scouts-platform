import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AdminDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: person } = await supabase.from("persons").select("id").eq("user_id", user.id).single();
  if (!person) redirect("/setup");

  const { data: membership } = await supabase
    .from("memberships").select("org_id").eq("person_id", person.id).eq("status", "active").single();
  if (!membership) redirect("/setup");

  const orgId = membership.org_id;

  const [
    { count: memberCount },
    { count: eventCount },
    { data: pendingForms },
    { data: recentLedger },
  ] = await Promise.all([
    supabase.from("memberships").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "active"),
    supabase.from("events").select("*", { count: "exact", head: true }).eq("org_id", orgId).gte("start_at", new Date().toISOString()),
    supabase.from("forms").select("id, type, persons(first_name, last_name)").eq("org_id", orgId).is("signed_at", null).limit(5),
    supabase.from("ledger_entries").select("amount_cents, description, created_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(5),
  ]);

  const stats = [
    { label: "Active members", value: memberCount ?? 0, href: "/admin/members", color: "#1F5F4A" },
    { label: "Upcoming events", value: eventCount ?? 0, href: "/admin/events", color: "#FF6A1A" },
    { label: "Unsigned forms", value: pendingForms?.length ?? 0, href: "/admin/forms", color: pendingForms?.length ? "#C0392B" : "#1F5F4A" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display font-extrabold text-[28px] m-0">Admin Dashboard</h1>
        <p className="text-[14px] m-0 mt-1" style={{ color: "#4D5F57" }}>Overview of your troop</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}
            className="bg-white rounded-2xl p-5 flex flex-col gap-1 no-underline border border-[#D5DFDA]"
            style={{ color: "#14211B" }}>
            <span className="font-display font-extrabold text-[36px] leading-none" style={{ color: s.color }}>{s.value}</span>
            <span className="text-[13px] font-bold" style={{ color: "#4D5F57" }}>{s.label}</span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Unsigned forms */}
        <div className="bg-white rounded-2xl border border-[#D5DFDA] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#EAF0ED] flex items-center justify-between">
            <span className="font-bold text-[15px]">Unsigned forms</span>
            <Link href="/admin/forms" className="text-[13px] font-bold no-underline" style={{ color: "#1F5F4A" }}>View all</Link>
          </div>
          {!pendingForms?.length ? (
            <div className="px-5 py-8 text-center text-[14px]" style={{ color: "#9DB0A7" }}>All forms signed</div>
          ) : (
            <table className="w-full">
              <tbody>
                {pendingForms.map((f) => (
                  <tr key={f.id} className="border-b border-[#EAF0ED] last:border-0">
                    <td className="px-5 py-3 text-[14px]">
                      {(f.persons as any)?.first_name} {(f.persons as any)?.last_name}
                    </td>
                    <td className="px-5 py-3 text-[13px]" style={{ color: "#4D5F57" }}>{f.type.replace(/_/g, " ")}</td>
                    <td className="px-5 py-3 text-right">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: "#FFF1E6", color: "#7A2E00" }}>Pending</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent ledger */}
        <div className="bg-white rounded-2xl border border-[#D5DFDA] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#EAF0ED] flex items-center justify-between">
            <span className="font-bold text-[15px]">Recent transactions</span>
            <Link href="/admin/ledger" className="text-[13px] font-bold no-underline" style={{ color: "#1F5F4A" }}>View all</Link>
          </div>
          {!recentLedger?.length ? (
            <div className="px-5 py-8 text-center text-[14px]" style={{ color: "#9DB0A7" }}>No transactions yet</div>
          ) : (
            <table className="w-full">
              <tbody>
                {recentLedger.map((e, i) => (
                  <tr key={i} className="border-b border-[#EAF0ED] last:border-0">
                    <td className="px-5 py-3 text-[14px]">{e.description ?? "—"}</td>
                    <td className="px-5 py-3 text-[14px] text-right font-bold"
                      style={{ color: e.amount_cents < 0 ? "#1F5F4A" : "#14211B" }}>
                      {e.amount_cents < 0 ? "−" : "+"}${Math.abs(e.amount_cents / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

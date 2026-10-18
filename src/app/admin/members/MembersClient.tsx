"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const ROLES = [
  "scout","parent_guardian","scoutmaster","assistant_scoutmaster","committee_chair",
  "committee_member","treasurer","advancement_chair","chartered_org_rep",
  "den_leader","cubmaster","crew_advisor","skipper",
];
const ROLE_LABEL: Record<string, string> = {
  scout: "Scout", parent_guardian: "Parent/Guardian", scoutmaster: "Scoutmaster",
  assistant_scoutmaster: "Asst. Scoutmaster", committee_chair: "Committee Chair",
  committee_member: "Committee Member", treasurer: "Treasurer",
  advancement_chair: "Advancement Chair", chartered_org_rep: "Chartered Org Rep",
  den_leader: "Den Leader", cubmaster: "Cubmaster", crew_advisor: "Crew Advisor",
  skipper: "Skipper",
};

type Member = {
  id: string; role: string; status: string; joined_at: string; ypt_expires: string | null;
  persons: { id: string; first_name: string; last_name: string; type: string; birthdate: string | null; user_id: string | null };
};

export default function MembersClient({ members: initial, orgId, myRole }: {
  members: Member[]; orgId: string; myRole: string;
}) {
  const supabase = createClient();
  const [members, setMembers] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  // Add member form
  const [showAdd, setShowAdd] = useState(false);
  const [addFirst, setAddFirst] = useState("");
  const [addLast, setAddLast] = useState("");
  const [addType, setAddType] = useState<"adult" | "youth">("youth");
  const [addRole, setAddRole] = useState("scout");
  const [addBirth, setAddBirth] = useState("");

  const reload = async () => {
    const { data } = await supabase
      .from("memberships")
      .select("id, role, status, joined_at, ypt_expires, persons(id, first_name, last_name, type, birthdate, user_id)")
      .eq("org_id", orgId)
      .order("joined_at", { ascending: false });
    setMembers((data as Member[]) ?? []);
  };

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const { data: newPerson, error: pe } = await supabase
        .from("persons")
        .insert({ first_name: addFirst, last_name: addLast, type: addType, birthdate: addBirth || null })
        .select("id").single();
      if (pe) throw pe;

      const { error: me } = await supabase
        .from("memberships")
        .insert({ org_id: orgId, person_id: newPerson.id, role: addRole, status: "active" });
      if (me) throw me;

      setAddFirst(""); setAddLast(""); setAddBirth(""); setAddRole("scout"); setAddType("youth");
      setShowAdd(false);
      await reload();
    } catch (e: any) { setError(e.message); }
    setBusy(false);
  };

  const changeRole = async (membershipId: string, role: string) => {
    setBusy(true); setError("");
    const { error } = await supabase.from("memberships").update({ role }).eq("id", membershipId);
    if (error) setError(error.message);
    else await reload();
    setBusy(false);
  };

  const changeStatus = async (membershipId: string, status: string) => {
    setBusy(true); setError("");
    const { error } = await supabase.from("memberships").update({ status }).eq("id", membershipId);
    if (error) setError(error.message);
    else await reload();
    setBusy(false);
  };

  const filtered = members.filter((m) => {
    const name = `${m.persons.first_name} ${m.persons.last_name}`.toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase());
    const matchFilter = filter === "all" || m.status === filter || m.persons.type === filter;
    return matchSearch && matchFilter;
  });

  const yptExpired = (iso: string | null) => iso && new Date(iso) < new Date();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-extrabold text-[28px] m-0">Members</h1>
          <p className="text-[14px] m-0 mt-1" style={{ color: "#4D5F57" }}>{members.filter(m => m.status === "active").length} active members</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          className="min-h-[40px] px-5 rounded-full font-bold text-[14px] border-0 cursor-pointer"
          style={{ background: "#FF6A1A", color: "#14211B", fontFamily: "inherit" }}>
          + Add member
        </button>
      </div>

      {error && <div className="rounded-xl px-4 py-3 text-[14px] font-bold" style={{ background: "#FFF1E6", color: "#7A2E00" }}>{error}</div>}

      {/* Add form */}
      {showAdd && (
        <form onSubmit={addMember} className="bg-white rounded-2xl border border-[#D5DFDA] p-5 flex flex-col gap-4">
          <div className="font-bold text-[16px]">Add a member</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-bold uppercase tracking-wide" style={{ color: "#4D5F57" }}>First name</label>
              <input value={addFirst} onChange={e => setAddFirst(e.target.value)} required
                className="rounded-xl border border-[#D5DFDA] px-3 py-2 text-[14px] outline-none focus:border-forest"
                style={{ fontFamily: "inherit" }} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-bold uppercase tracking-wide" style={{ color: "#4D5F57" }}>Last name</label>
              <input value={addLast} onChange={e => setAddLast(e.target.value)} required
                className="rounded-xl border border-[#D5DFDA] px-3 py-2 text-[14px] outline-none focus:border-forest"
                style={{ fontFamily: "inherit" }} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-bold uppercase tracking-wide" style={{ color: "#4D5F57" }}>Type</label>
              <select value={addType} onChange={e => setAddType(e.target.value as "adult" | "youth")}
                className="rounded-xl border border-[#D5DFDA] px-3 py-2 text-[14px] outline-none"
                style={{ fontFamily: "inherit" }}>
                <option value="youth">Youth (Scout)</option>
                <option value="adult">Adult (Leader / Parent)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-bold uppercase tracking-wide" style={{ color: "#4D5F57" }}>Role</label>
              <select value={addRole} onChange={e => setAddRole(e.target.value)}
                className="rounded-xl border border-[#D5DFDA] px-3 py-2 text-[14px] outline-none"
                style={{ fontFamily: "inherit" }}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-bold uppercase tracking-wide" style={{ color: "#4D5F57" }}>Birthdate (optional)</label>
              <input type="date" value={addBirth} onChange={e => setAddBirth(e.target.value)}
                className="rounded-xl border border-[#D5DFDA] px-3 py-2 text-[14px] outline-none"
                style={{ fontFamily: "inherit" }} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy}
              className="min-h-[38px] px-5 rounded-full font-bold text-[14px] border-0 cursor-pointer"
              style={{ background: "#1F5F4A", color: "#fff", fontFamily: "inherit" }}>
              {busy ? "Adding…" : "Add member"}
            </button>
            <button type="button" onClick={() => setShowAdd(false)}
              className="min-h-[38px] px-5 rounded-full font-bold text-[14px] border border-[#D5DFDA] bg-white cursor-pointer"
              style={{ fontFamily: "inherit", color: "#14211B" }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="rounded-xl border border-[#D5DFDA] px-3 py-2 text-[14px] outline-none w-56"
          style={{ fontFamily: "inherit" }} />
        <div className="flex gap-1">
          {["all","active","inactive","youth","adult"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-full text-[12px] font-bold border cursor-pointer capitalize"
              style={{
                fontFamily: "inherit",
                background: filter === f ? "#1F5F4A" : "white",
                color: filter === f ? "white" : "#4D5F57",
                borderColor: filter === f ? "#1F5F4A" : "#D5DFDA",
              }}>
              {f === "all" ? "All" : f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#D5DFDA] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid #EAF0ED" }}>
              {["Name", "Type", "Role", "YPT", "Status", "Joined", ""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide" style={{ color: "#9DB0A7" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-[14px]" style={{ color: "#9DB0A7" }}>No members found</td></tr>
            )}
            {filtered.map((m) => (
              <tr key={m.id} className="border-b border-[#EAF0ED] last:border-0"
                style={{ opacity: m.status === "inactive" ? 0.5 : 1 }}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold flex-none text-white"
                      style={{ background: m.persons.type === "youth" ? "#1F5F4A" : "#4D5F57" }}>
                      {m.persons.first_name[0]}{m.persons.last_name[0]}
                    </div>
                    <span className="font-bold text-[14px]">{m.persons.first_name} {m.persons.last_name}</span>
                    {m.persons.user_id && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#EAF0ED", color: "#1F5F4A" }}>Account</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-[13px] capitalize" style={{ color: "#4D5F57" }}>{m.persons.type}</td>
                <td className="px-4 py-3">
                  <select value={m.role} disabled={busy}
                    onChange={e => changeRole(m.id, e.target.value)}
                    className="rounded-lg border border-[#D5DFDA] px-2 py-1 text-[13px] outline-none"
                    style={{ fontFamily: "inherit" }}>
                    {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3 text-[13px]">
                  {m.persons.type === "adult" ? (
                    m.ypt_expires ? (
                      <span style={{ color: yptExpired(m.ypt_expires) ? "#C0392B" : "#1F5F4A" }} className="font-bold text-[12px]">
                        {yptExpired(m.ypt_expires) ? "Expired" : new Date(m.ypt_expires).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </span>
                    ) : <span style={{ color: "#9DB0A7" }}>—</span>
                  ) : <span style={{ color: "#9DB0A7" }}>N/A</span>}
                </td>
                <td className="px-4 py-3">
                  <span className="text-[12px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: m.status === "active" ? "#EAF0ED" : "#F4F6F5",
                      color: m.status === "active" ? "#1F5F4A" : "#9DB0A7",
                    }}>
                    {m.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-[13px]" style={{ color: "#4D5F57" }}>
                  {new Date(m.joined_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </td>
                <td className="px-4 py-3 text-right">
                  {m.status === "active" ? (
                    <button onClick={() => changeStatus(m.id, "inactive")} disabled={busy}
                      className="text-[12px] font-bold px-3 py-1.5 rounded-full border cursor-pointer"
                      style={{ fontFamily: "inherit", borderColor: "#D5DFDA", color: "#C0392B", background: "white" }}>
                      Deactivate
                    </button>
                  ) : (
                    <button onClick={() => changeStatus(m.id, "active")} disabled={busy}
                      className="text-[12px] font-bold px-3 py-1.5 rounded-full border cursor-pointer"
                      style={{ fontFamily: "inherit", borderColor: "#D5DFDA", color: "#1F5F4A", background: "white" }}>
                      Restore
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

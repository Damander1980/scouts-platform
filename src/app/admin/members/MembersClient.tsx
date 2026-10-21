"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Chip, ErrorBox, Field } from "@/components/ui";

const ROLES = [
  "scout", "parent_guardian", "scoutmaster", "assistant_scoutmaster", "committee_chair",
  "committee_member", "treasurer", "advancement_chair", "chartered_org_rep",
  "den_leader", "cubmaster", "crew_advisor", "skipper", "merit_badge_counselor",
];
const ROLE_LABEL: Record<string, string> = {
  scout: "Scout", parent_guardian: "Parent/Guardian", scoutmaster: "Scoutmaster",
  assistant_scoutmaster: "Asst. Scoutmaster", committee_chair: "Committee Chair",
  committee_member: "Committee Member", treasurer: "Treasurer",
  advancement_chair: "Advancement Chair", chartered_org_rep: "Chartered Org Rep",
  den_leader: "Den Leader", cubmaster: "Cubmaster", crew_advisor: "Crew Advisor",
  skipper: "Skipper", merit_badge_counselor: "Merit Badge Counselor",
};

export type Member = {
  id: string; role: string; status: string; joined_at: string; ypt_expires: string | null;
  is_admin?: boolean; is_designated_leader?: boolean; position?: string | null; registration_expires?: string | null;
  persons: { id: string; first_name: string; last_name: string; type: string; birthdate: string | null; user_id: string | null };
};
export type Badge = { id: string; name: string; eagle_required: boolean };
export type CounselorAssignment = { person_id: string; item_id: string };
export type JoinRequest = { id: string; created_at: string; requester: string; people: { id: string; name: string; type: string; birthdate: string | null }[] };

function age(b: string | null) {
  if (!b) return null;
  const d = new Date(b), n = new Date();
  return n.getFullYear() - d.getFullYear() - (n < new Date(n.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
}

export default function MembersClient({
  members: initial, orgId, myRole, badges = [], counselorAssignments = [], demo = false,
  joinCode = "", slug = "", isAdmin = true, myPersonId = "", joinRequests = [], patrolOf = {}, initialTab = "members", initialSearch = "",
  households = [], personHouseholds = [],
}: {
  households?: { household_id: string; household_name: string; members: string }[];
  personHouseholds?: { person_id: string; household_id: string; household_name: string }[];
  members: Member[]; orgId: string; myRole?: string;
  badges?: Badge[]; counselorAssignments?: CounselorAssignment[]; demo?: boolean;
  joinCode?: string; slug?: string; isAdmin?: boolean; myPersonId?: string;
  joinRequests?: JoinRequest[]; patrolOf?: Record<string, string>; initialTab?: "members" | "requests"; initialSearch?: string;
}) {
  void myRole;
  const supabase = createClient();
  const router = useRouter();
  const [members, setMembers] = useState(initial);
  const [tab, setTab] = useState(initialTab);
  const [requests, setRequests] = useState(joinRequests);
  const [assignments, setAssignments] = useState(counselorAssignments);
  const [editing, setEditing] = useState<string | null>(null);
  const [badgeSearch, setBadgeSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(initialSearch);
  const [filter, setFilter] = useState(initialSearch ? "all" : "active");
  const [showAdd, setShowAdd] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [mergeFrom, setMergeFrom] = useState<{ keep: string; drop: string } | null>(null);
  const [add, setAdd] = useState({ first: "", last: "", type: "youth", role: "scout", birth: "" });
  const [claim, setClaim] = useState<{ pid: string; code: string } | null>(null);
  const badgeName = Object.fromEntries(badges.map((b) => [b.id, b.name]));
  const site = typeof window !== "undefined" ? window.location.origin : "";
  // Ready-to-send invite for an email or group text; families finish setup in a couple of minutes.
  const inviteText = `Our troop is moving sign-ups, payments and forms online. Create your family's account and ask to join here:

${site}/join/${slug}

Or enter join code ${String(joinCode ?? "").toUpperCase()} after you sign up. Add your Scouts when it asks; a leader will approve you.`;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await fn(); } catch (e: any) { setError(e.message ?? String(e)); }
    setBusy(false);
  };

  const patch = (id: string, values: Partial<Member>) => run(async () => {
    if (!demo) {
      const { error } = await supabase.from("memberships").update(values).eq("id", id);
      if (error) throw error;
    }
    setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, ...values } : m)));
  });

  const decide = (rid: string, approve: boolean) => run(async () => {
    const { error } = await supabase.rpc("decide_join", { p_request: rid, p_approve: approve });
    if (error) throw error;
    setRequests((rs) => rs.filter((r) => r.id !== rid));
    router.refresh();
  });

  const addPerson = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const { error } = await supabase.rpc("admin_add_person", {
        p_org: orgId, p_first: add.first, p_last: add.last, p_type: add.type, p_birthdate: add.birth || null, p_role: add.role, p_household: null,
      });
      if (error) throw error;
      setAdd({ first: "", last: add.last, type: "youth", role: "scout", birth: "" });
      setShowAdd(false);
      router.refresh();
    });
  };

  const toggleCounselorBadge = (personId: string, itemId: string) => run(async () => {
    const has = assignments.some((a) => a.person_id === personId && a.item_id === itemId);
    if (!demo) {
      const { error } = has
        ? await supabase.from("merit_badge_counselors").delete().eq("org_id", orgId).eq("person_id", personId).eq("item_id", itemId)
        : await supabase.from("merit_badge_counselors").insert({ org_id: orgId, person_id: personId, item_id: itemId });
      if (error) throw error;
    }
    setAssignments((cur) => has ? cur.filter((a) => !(a.person_id === personId && a.item_id === itemId)) : [...cur, { person_id: personId, item_id: itemId }]);
  });

  const shown = members.filter((m) => {
    const name = `${m.persons.first_name} ${m.persons.last_name}`.toLowerCase();
    if (search && !name.includes(search.toLowerCase())) return false;
    if (filter === "active") return m.status === "active";
    if (filter === "inactive") return m.status !== "active";
    if (filter === "youth" || filter === "adult") return m.persons.type === filter && m.status === "active";
    if (filter === "leaders") return m.status === "active" && !["scout", "parent_guardian"].includes(m.role);
    return true;
  }).sort((a, b) => a.persons.last_name.localeCompare(b.persons.last_name) || a.persons.first_name.localeCompare(b.persons.first_name));

  const expired = (d?: string | null) => !!d && new Date(d) < new Date();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display font-extrabold text-[32px] m-0">Members</h1>
          <p className="text-[14px] m-0 mt-1 text-smoke">
            {members.filter((m) => m.status === "active").length} active ·{" "}
            <a href="/api/export/roster.csv" className="font-bold text-forest">Download roster</a> ·{" "}
            <a href="/admin/members/bulk" className="font-bold text-forest">Update all</a>
          </p>
        </div>
        <div className="flex gap-2">
          {joinCode && <button onClick={() => setShowInvite(!showInvite)} className="btn-secondary">Invite families</button>}
          {isAdmin && <button onClick={() => setShowAdd(!showAdd)} className="btn-primary">+ Add member</button>}
        </div>
      </div>

      <ErrorBox>{error}</ErrorBox>

      {joinCode && showInvite && (
        <div className="card flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1">
            <div className="font-bold text-[15px]">Invite families</div>
            <div className="text-[13px] text-smoke">Families sign in, add their kids and ask to join. You approve them here.</div>
          </div>
          <div className="font-display font-extrabold text-[22px] tracking-widest">{joinCode.toUpperCase()}</div>
          <div className="flex gap-2 flex-wrap">
            <button className="btn-primary" onClick={() => navigator.clipboard.writeText(`${site}/join/${slug}`)}>Copy invite link</button>
            <a className="btn-secondary no-underline" href={`mailto:?subject=${encodeURIComponent("Join our troop online")}&body=${encodeURIComponent(inviteText)}`}>Email the invite</a>
            <button className="btn-ghost" onClick={() => navigator.clipboard.writeText(inviteText)}>Copy invite message</button>
          </div>
        </div>
      )}

      {requests.length > 0 && tab !== "requests" && (
        <div className="card flex items-center gap-3 flex-wrap" style={{ background: "#FFF6D6" }}>
          <span className="flex-1 font-bold text-[15px]" style={{ color: "#5E4400" }}>
            {requests.length === 1 ? "1 family is" : `${requests.length} families are`} waiting to join.
          </span>
          <button className="btn-primary" onClick={() => setTab("requests")}>Review</button>
        </div>
      )}

      {showAdd && (
        <form onSubmit={addPerson} className="card flex flex-col gap-3">
          <div className="font-bold text-[16px]">Add a member directly</div>
          <p className="text-[13px] text-smoke m-0">For people without an account yet. Give their parent a claim code later so they can take over the record.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="First name"><input className="input" value={add.first} onChange={(e) => setAdd({ ...add, first: e.target.value })} required /></Field>
            <Field label="Last name"><input className="input" value={add.last} onChange={(e) => setAdd({ ...add, last: e.target.value })} required /></Field>
            <Field label="Youth or adult">
              <select className="input" value={add.type} onChange={(e) => setAdd({ ...add, type: e.target.value, role: e.target.value === "youth" ? "scout" : "parent_guardian" })}>
                <option value="youth">Youth</option><option value="adult">Adult</option>
              </select>
            </Field>
            <Field label="Role">
              <select className="input" value={add.role} onChange={(e) => setAdd({ ...add, role: e.target.value })}>
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </Field>
            <Field label="Birthday"><input className="input" type="date" value={add.birth} onChange={(e) => setAdd({ ...add, birth: e.target.value })} /></Field>
          </div>
          <div className="flex gap-2"><button className="btn-primary" disabled={busy}>Add</button><button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button></div>
        </form>
      )}

      {tab === "requests" && (
        <div className="flex flex-col gap-2">
          <button className="btn-ghost self-start" onClick={() => setTab("members")}>← Back to members</button>
          {requests.length === 0 && <div className="card text-smoke">No pending requests.</div>}
          {requests.map((r) => (
            <div key={r.id} className="card flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div><b>{r.requester}</b> <span className="text-smoke text-[13px]">asked {new Date(r.created_at).toLocaleDateString()}</span></div>
                {isAdmin ? (
                  <div className="flex gap-2">
                    <button className="btn-primary" disabled={busy} onClick={() => decide(r.id, true)}>Approve</button>
                    <button className="btn-secondary" disabled={busy} onClick={() => decide(r.id, false)}>Decline</button>
                  </div>
                ) : <Chip>An admin will approve</Chip>}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {r.people.map((p) => <Chip key={p.id} tone={p.type === "youth" ? "green" : "gray"}>{p.name}{p.type === "youth" && age(p.birthdate) !== null ? `, ${age(p.birthdate)}` : p.type === "adult" ? " (adult)" : ""}</Chip>)}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "members" && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name" aria-label="Search by name" className="input flex-1 min-w-[200px] max-w-md" />
            <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Show" className="input w-auto">
              <option value="active">Everyone active</option>
              <option value="youth">Scouts</option>
              <option value="adult">Adults</option>
              <option value="leaders">Leaders</option>
              <option value="inactive">Inactive</option>
              <option value="all">Everyone</option>
            </select>
          </div>

          <div className="card p-0 overflow-hidden flex flex-col">
            {shown.length === 0 && <div className="p-5 text-smoke">No members match.</div>}
            {shown.map((m) => {
              const a = age(m.persons.birthdate);
              const isOpen = editing === m.id;
              return (
                <div key={m.id} className="px-5 py-3.5 flex flex-col gap-2 border-b border-[#EAE4D6] last:border-0" style={{ opacity: m.status === "active" ? 1 : 0.55, background: isOpen ? "#F8F5EE" : undefined }}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-[13px] flex-none"
                      style={{ background: m.persons.type === "youth" ? "#12355F" : "#4B5568" }}>{m.persons.first_name[0]}{m.persons.last_name[0]}</div>
                    <div className="flex-1 min-w-[160px]">
                      <div className="font-bold text-[15px]">{m.persons.first_name} {m.persons.last_name}</div>
                      <div className="text-[13px] text-smoke">
                        {ROLE_LABEL[m.role] ?? m.role}{m.position ? ` · ${m.position}` : ""}{patrolOf[m.persons.id] ? ` · ${patrolOf[m.persons.id]}` : ""}
                        {m.persons.type === "youth" && a !== null ? ` · age ${a}` : ""}
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {m.is_admin && <Chip tone="dark">Admin</Chip>}
                      {m.persons.type === "adult" && !["parent_guardian", "scout"].includes(m.role) && (
                        !m.ypt_expires ? <Chip tone="orange">YPT not recorded</Chip>
                          : expired(m.ypt_expires) ? <Chip tone="red">YPT expired</Chip> : null
                      )}
                      {m.persons.type === "youth" && a !== null && a >= 18 && <Chip tone="orange">Turned 18</Chip>}
                    </div>
                    {m.persons.type === "youth" && <a href={`/scout/${m.persons.id}/advancement`} className="text-[13px] font-bold text-forest no-underline">Advancement</a>}
                    {isAdmin && <button className="btn-ghost" onClick={() => setEditing(isOpen ? null : m.id)}>{isOpen ? "Done" : "Edit"}</button>}
                  </div>

                  {m.role === "merit_badge_counselor" && (
                    <div className="flex flex-wrap gap-1 items-center pl-[52px]">
                      {assignments.filter((x) => x.person_id === m.persons.id).map((x) => <Chip key={x.item_id} tone="green">{badgeName[x.item_id] ?? "Badge"}</Chip>)}
                      {!assignments.some((x) => x.person_id === m.persons.id) && <span className="text-[12px] text-smoke">No badges approved yet</span>}
                    </div>
                  )}

                  {isOpen && (
                    <div className="grid md:grid-cols-2 gap-3 pt-2 border-t border-[#EEE8D9]">
                      <Field label="Role">
                        <select className="input" value={m.role} disabled={busy} onChange={(e) => patch(m.id, { role: e.target.value })}>
                          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                        </select>
                      </Field>
                      <Field label="Troop position" hint="Youth positions of responsibility are tracked on Patrols & positions.">
                        <input className="input" defaultValue={m.position ?? ""} placeholder="e.g. Committee secretary"
                          onBlur={(e) => e.target.value !== (m.position ?? "") && patch(m.id, { position: e.target.value || null })} />
                      </Field>
                      {m.persons.type === "adult" && (
                        <>
                          <Field label="Youth Protection Training expires">
                            <input className="input" type="date" defaultValue={m.ypt_expires ?? ""} onBlur={(e) => patch(m.id, { ypt_expires: e.target.value || null })} />
                          </Field>
                          <Field label="Registration expires">
                            <input className="input" type="date" defaultValue={m.registration_expires ?? ""} onBlur={(e) => patch(m.id, { registration_expires: e.target.value || null })} />
                          </Field>
                          <label className="flex items-center gap-3 text-[15px]">
                            <input type="checkbox" className="w-5 h-5" checked={!!m.is_admin} disabled={busy}
                              onChange={(e) => patch(m.id, { is_admin: e.target.checked })} /> Unit admin (approves families, changes roles)
                          </label>
                          <label className="flex items-center gap-3 text-[15px]">
                            <input type="checkbox" className="w-5 h-5" checked={!!m.is_designated_leader} disabled={busy}
                              onChange={(e) => patch(m.id, { is_designated_leader: e.target.checked })} /> Designated leader (copied on messages to Scouts, records forms)
                          </label>
                        </>
                      )}
                      {m.role === "merit_badge_counselor" && (
                        <div className="md:col-span-2 flex flex-col gap-2">
                          <div className="font-bold text-[14px]">Badges this counselor may sign off</div>
                          <input aria-label="Search badges" value={badgeSearch} onChange={(e) => setBadgeSearch(e.target.value)} placeholder="Search badges" className="input" />
                          <div className="max-h-56 overflow-y-auto grid sm:grid-cols-2">
                            {badges.filter((b) => !badgeSearch || b.name.toLowerCase().includes(badgeSearch.toLowerCase())).map((b) => (
                              <label key={b.id} className="flex items-center gap-2 py-1 text-[13px]">
                                <input type="checkbox" checked={assignments.some((x) => x.person_id === m.persons.id && x.item_id === b.id)}
                                  onChange={() => toggleCounselorBadge(m.persons.id, b.id)} disabled={busy} />
                                {b.name}{b.eagle_required && <span className="text-[10px] font-bold" style={{ color: "#5E4400" }}>Eagle</span>}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      {m.persons.type === "youth" && (
                        <div className="md:col-span-2 flex flex-col gap-2">
                          <div className="font-bold text-[14px]">Family</div>
                          {personHouseholds.filter((h) => h.person_id === m.persons.id).map((h) => (
                            <div key={h.household_id} className="flex items-center gap-2 text-[14px]">
                              <Chip tone="green">{h.household_name}</Chip>
                              <span className="text-smoke text-[12px]">{households.find((x) => x.household_id === h.household_id)?.members}</span>
                              <button className="btn-ghost text-[13px] ml-auto" disabled={busy} onClick={() => run(async () => {
                                const { error } = await supabase.rpc("detach_child_from_family", { p_org: orgId, p_child: m.persons.id, p_household: h.household_id });
                                if (error) throw error; router.refresh();
                              })}>Remove from this family</button>
                            </div>
                          ))}
                          <div className="flex gap-2 flex-wrap items-center">
                            <select className="input h-10 min-h-0" defaultValue="" disabled={busy} onChange={(e) => e.target.value && run(async () => {
                              const { error } = await supabase.rpc("attach_child_to_family", { p_org: orgId, p_child: m.persons.id, p_household: e.target.value });
                              if (error) throw error; e.target.value = ""; router.refresh();
                            })}>
                              <option value="" disabled>Attach to a family…</option>
                              {households.filter((h) => !personHouseholds.some((x) => x.person_id === m.persons.id && x.household_id === h.household_id))
                                .map((h) => <option key={h.household_id} value={h.household_id}>{h.household_name} ({h.members})</option>)}
                            </select>
                            <span className="text-[12px] text-smoke">A Scout can belong to two families (for example, two parents in separate homes).</span>
                          </div>
                        </div>
                      )}
                      {isAdmin && !demo && (
                        <div className="md:col-span-2 flex flex-col gap-2 rounded-xl p-3" style={{ background: "#F8F5EE" }}>
                          <div className="font-bold text-[14px]">Duplicate record?</div>
                          <div className="flex gap-2 flex-wrap items-center">
                            <select className="input h-10 min-h-0 flex-1 min-w-[200px]" aria-label="Duplicate to merge in"
                              value={mergeFrom?.keep === m.persons.id ? mergeFrom.drop : ""}
                              onChange={(e) => setMergeFrom(e.target.value ? { keep: m.persons.id, drop: e.target.value } : null)}>
                              <option value="">Merge a duplicate into {m.persons.first_name}…</option>
                              {members.filter((x) => x.persons.id !== m.persons.id && x.persons.type === m.persons.type)
                                .map((x) => <option key={x.persons.id} value={x.persons.id}>{x.persons.first_name} {x.persons.last_name}</option>)}
                            </select>
                            {mergeFrom?.keep === m.persons.id && (
                              <button className="btn-primary" disabled={busy} onClick={() => run(async () => {
                                const { error } = await supabase.rpc("merge_persons", { p_org: orgId, p_keep: mergeFrom.keep, p_drop: mergeFrom.drop });
                                if (error) throw error;
                                setMergeFrom(null); router.refresh();
                              })}>Merge into {m.persons.first_name}</button>
                            )}
                          </div>
                          <span className="text-[12px] text-smoke">Sign-ups, attendance, forms, payments and advancement move to this record. Messages stay as they were. This can&apos;t be undone.</span>
                        </div>
                      )}
                      <div className="md:col-span-2 flex gap-2 flex-wrap">
                        {m.status === "active"
                          ? <button className="btn-secondary" disabled={busy || m.persons.id === myPersonId} onClick={() => patch(m.id, { status: "inactive" })}>Deactivate</button>
                          : <button className="btn-secondary" disabled={busy} onClick={() => patch(m.id, { status: "active" })}>Restore</button>}
                        {!m.persons.user_id && (
                          claim?.pid === m.persons.id
                            ? <span className="font-bold text-[14px] self-center">Claim code: <span className="tracking-widest">{claim.code}</span></span>
                            : <button className="btn-ghost" disabled={busy} onClick={() => run(async () => {
                                const { data, error } = await supabase.rpc("create_claim_code", { p_org: orgId, p_person: m.persons.id });
                                if (error) throw error;
                                setClaim({ pid: m.persons.id, code: String(data) });
                              })}>Make a claim code for this family</button>
                        )}
                        {m.persons.type === "youth" && a !== null && a >= 18 && (
                          <button className="btn-ghost" disabled={busy} onClick={() => run(async () => {
                            const { error } = await supabase.rpc("convert_to_adult", { p_org: orgId, p_person: m.persons.id, p_role: "assistant_scoutmaster" });
                            if (error) throw error;
                            router.refresh();
                          })}>Convert to adult leader (ASM)</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

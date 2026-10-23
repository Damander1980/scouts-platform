"use client";

import { useState } from "react";
import { Chip, ErrorBox, fmtDate } from "@/components/ui";
const ROLE_LABELS: Record<string, string> = {
  scoutmaster: "Scoutmaster", assistant_scoutmaster: "Asst. Scoutmaster", committee_chair: "Committee Chair",
  committee_member: "Committee Member", treasurer: "Treasurer", advancement_chair: "Advancement Chair",
  chartered_org_rep: "Chartered Org Rep", parent_guardian: "Parent", scout: "Scout", merit_badge_counselor: "MB Counselor",
};

export type Unit = {
  id: string; name: string; unit_number: string | null; city: string | null; state: string | null;
  subscription_status: string; created_at: string; scouts: number; adults: number; logins: number; admins: number; pending_requests: number;
};
export type PersonRow = {
  person_id: string; display_name: string; type: "adult" | "youth"; has_login: boolean; email: string | null; created_at: string;
  units: { org: string; org_id: string; role: string; status: string; admin: boolean }[];
};

export default function PlatformClient({ units, people, error }: { units: Unit[]; people: PersonRow[]; error: string }) {
  const [tab, setTab] = useState<"units" | "people">("units");
  const [unit, setUnit] = useState("");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");

  const shown = people.filter((p) => {
    if (unit && !p.units.some((u) => u.org_id === unit)) return false;
    if (kind === "youth" || kind === "adult") { if (p.type !== kind) return false; }
    if (kind === "logins" && !p.has_login) return false;
    if (kind === "none" && p.units.length) return false;
    const q = search.toLowerCase();
    return !q || p.display_name.toLowerCase().includes(q) || (p.email ?? "").toLowerCase().includes(q);
  });
  const total = (k: keyof Unit) => units.reduce((s, u) => s + Number(u[k] ?? 0), 0);

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-5">
      <div>
        <div className="eyebrow">Platform owner</div>
        <h1 className="font-display font-extrabold text-[32px] m-0">All troops and users</h1>
        <p className="text-[14px] m-0 mt-1 text-smoke">
          {units.length} troops · {total("scouts")} Scouts · {total("adults")} adults · {people.filter((p) => p.has_login).length} logins.
          Names show first name and last initial only. Each visit is recorded in the audit log.
        </p>
      </div>
      <ErrorBox>{error}</ErrorBox>

      <div className="flex gap-2">
        <button className={tab === "units" ? "btn-primary" : "btn-secondary"} onClick={() => setTab("units")}>Troops ({units.length})</button>
        <button className={tab === "people" ? "btn-primary" : "btn-secondary"} onClick={() => setTab("people")}>Users ({people.length})</button>
      </div>

      {tab === "units" && (
        <div className="card p-0 overflow-hidden flex flex-col">
          {units.length === 0 && <div className="p-5 text-smoke">No troops yet.</div>}
          {units.map((u) => (
            <div key={u.id} className="px-5 py-3.5 flex items-center gap-3 flex-wrap border-b border-[#EAE4D6] last:border-0">
              <div className="flex-1 min-w-[200px]">
                <div className="font-bold text-[15px]">{u.name}{u.unit_number ? ` ${u.unit_number}` : ""}</div>
                <div className="text-[13px] text-smoke">
                  {[u.city, u.state].filter(Boolean).join(", ") || "No location"} · started {fmtDate(u.created_at, { month: "short", day: "numeric", year: "numeric" })}
                </div>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                <Chip tone={u.subscription_status === "active" ? "green" : u.subscription_status === "trial" ? "gray" : "red"}>{u.subscription_status}</Chip>
                <Chip>{u.scouts} Scouts</Chip>
                <Chip>{u.adults} adults</Chip>
                <Chip>{u.logins} logins</Chip>
                <Chip tone={u.admins < 2 ? "orange" : "gray"}>{u.admins} {u.admins === 1 ? "admin" : "admins"}</Chip>
                {u.pending_requests > 0 && <Chip tone="orange">{u.pending_requests} waiting to join</Chip>}
              </div>
              <button className="btn-ghost" onClick={() => { setUnit(u.id); setTab("people"); }}>See users</button>
            </div>
          ))}
        </div>
      )}

      {tab === "people" && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" aria-label="Search name or email" className="input flex-1 min-w-[200px] max-w-md" />
            <select value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Troop" className="input w-auto">
              <option value="">All troops</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}{u.unit_number ? ` ${u.unit_number}` : ""}</option>)}
            </select>
            <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Show" className="input w-auto">
              <option value="all">Everyone</option>
              <option value="youth">Scouts</option>
              <option value="adult">Adults</option>
              <option value="logins">Has a login</option>
              <option value="none">In no troop</option>
            </select>
          </div>
          <div className="card p-0 overflow-hidden flex flex-col">
            <div className="px-5 py-2 text-[13px] text-smoke border-b border-[#EAE4D6]">{shown.length} shown</div>
            {shown.length === 0 && <div className="p-5 text-smoke">Nobody matches.</div>}
            {shown.map((p) => (
              <div key={p.person_id} className="px-5 py-3 flex items-center gap-3 flex-wrap border-b border-[#EAE4D6] last:border-0">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-[13px] flex-none"
                  style={{ background: p.type === "youth" ? "#12355F" : "#4B5568" }}>{p.display_name[0]}</div>
                <div className="flex-1 min-w-[180px]">
                  <div className="font-bold text-[15px]">{p.display_name}</div>
                  <div className="text-[13px] text-smoke">
                    {p.type === "youth" ? "Scout" : "Adult"}{p.email ? ` · ${p.email}` : ""}{!p.has_login ? " · no login" : ""}
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {p.units.length === 0 && <Chip tone="orange">In no troop</Chip>}
                  {p.units.map((u) => (
                    <Chip key={u.org_id + u.role} tone={u.status === "active" ? (u.admin ? "dark" : "gray") : "orange"}>
                      {u.org} · {ROLE_LABELS[u.role] ?? u.role}{u.admin ? " · admin" : ""}{u.status !== "active" ? ` · ${u.status}` : ""}
                    </Chip>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

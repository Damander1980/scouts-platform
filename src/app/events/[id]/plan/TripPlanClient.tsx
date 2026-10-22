"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Chip, ErrorBox, money } from "@/components/ui";

type Item = { id: string; text: string; done?: boolean; who?: string; due?: string; day?: string; time?: string; amount?: number; kind?: "per_person" | "flat"; patrol?: string; meal?: string; qty?: string; per?: number };
export type Plan = { itinerary: Item[]; costs: Item[]; meals: Item[]; packing: Item[]; tasks: Item[]; permits: Item[]; duties?: Item[] };
const JOBS = ["Cook", "Assistant cook", "Cleanup", "Water and fire"];

const PACKING: Record<string, string[]> = {
  "Weekend campout": ["Scout Basic Essentials (first aid kit, water bottle, flashlight, trail food, sun protection, map and compass, rain gear, pocketknife, extra clothing, matches)", "Sleeping bag rated for the weather", "Sleeping pad", "Mess kit and utensils", "Uniform (Class A for travel)", "Toiletries", "Health form A+B on file"],
  "Summer camp": ["Everything on the weekend list", "Swimsuit and towel", "Merit badge pamphlets and prerequisites", "Laundry bag", "Health form A, B and C (physician exam)", "Spending money for trading post"],
  "Backpacking": ["Backpack fitted and under 25% of body weight", "Lightweight tent or shelter (shared)", "Stove, fuel, and pot (shared)", "Water treatment", "Bear bag or canister where required", "Leave No Trace trowel"],
};
const SAFE = ["Supervision: qualified, trained adults (two registered adults 21+ with current YPT)", "Assessment: activity and site hazards reviewed", "Fitness and skill: Scouts' health forms and skills checked", "Equipment: correct gear and safety equipment", "Environment: weather forecast and emergency plan reviewed", "Discipline: rules explained to Scouts"];
const uid = () => Math.random().toString(36).slice(2, 10);

export default function TripPlanClient({ eventId, orgId, canEdit, title, costCents, plan: initial, youthGoing, adultsGoing, seats, patrols, adults, dutiesEnabled = false }: {
  eventId: string; orgId: string; canEdit: boolean; title: string; costCents: number; plan: Plan;
  youthGoing: number; adultsGoing: number; seats: number; patrols: { id: string; name: string; going: number; scouts?: string[] }[]; adults: { id: string; name: string }[];
  dutiesEnabled?: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [plan, setPlan] = useState<Plan>({ ...initial, duties: initial.duties ?? [], permits: initial.permits?.length ? initial.permits : SAFE.map((t) => ({ id: uid(), text: t })) });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const people = youthGoing + adultsGoing;

  // Saves are debounced and run one at a time with only the newest plan, so a slow older save can
  // never land last and undo typing.
  const pending = useRef<Plan | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = useRef(false);
  const push = async () => {
    if (running.current || !pending.current) return;
    running.current = true;
    const next = pending.current; pending.current = null;
    const row: Partial<Plan> = { ...next };
    if (!dutiesEnabled) delete row.duties;
    const { error } = await supabase.from("trip_plans").upsert({ event_id: eventId, org_id: orgId, ...row, updated_at: new Date().toISOString() });
    running.current = false;
    if (error) setError(error.message);
    if (pending.current) push(); else if (!error) setSaved(true);
  };
  const save = async (next: Plan) => {
    setPlan(next); setSaved(false); setError("");
    if (!canEdit) return;
    pending.current = next;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(push, 600);
  };
  const list = (k: keyof Plan) => plan[k] ?? [];
  const add = (k: keyof Plan, item: Partial<Item>) => save({ ...plan, [k]: [...list(k), { id: uid(), text: "", ...item }] });
  const update = (k: keyof Plan, id: string, patch: Partial<Item>) => save({ ...plan, [k]: list(k).map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  const remove = (k: keyof Plan, id: string) => save({ ...plan, [k]: list(k).filter((x) => x.id !== id) });

  // One-tap rotation: every meal this patrol planned gets each job, rotating through the patrol's Scouts.
  const fillRotation = (patrolId: string, scouts: string[]) => {
    const meals = [...new Set(plan.meals.filter((m) => m.patrol === patrolId).map((m) => m.meal).filter(Boolean))] as string[];
    const slots = (meals.length ? meals : ["Fri dinner", "Sat breakfast", "Sat lunch", "Sat dinner", "Sun breakfast"]);
    let i = 0;
    const rows = slots.flatMap((meal) => JOBS.map((job) => ({ id: uid(), patrol: patrolId, meal, text: job, who: scouts.length ? scouts[i++ % scouts.length] : "" })));
    save({ ...plan, duties: [...list("duties").filter((d) => d.patrol !== patrolId), ...rows] });
  };

  const totalCost = plan.costs.reduce((s, c) => s + (c.kind === "per_person" ? (c.amount ?? 0) * Math.max(youthGoing, 1) : (c.amount ?? 0)), 0);
  const perScout = youthGoing ? Math.ceil(totalCost / youthGoing) : totalCost;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="font-display font-extrabold text-[26px] m-0">Trip plan: {title}</h1>
          <p className="text-[14px] text-smoke m-0 mt-1">{youthGoing} youth and {adultsGoing} adults going · {seats} driver seats offered{seats < people - adultsGoing && people > 0 ? " (need more drivers)" : ""}</p>
        </div>
        {saved && <Chip tone="green">Saved</Chip>}
      </div>
      <ErrorBox>{error}</ErrorBox>

      <section className="card flex flex-col gap-2">
        <div className="font-bold text-[16px]">Cost calculator</div>
        {plan.costs.map((c) => (
          <div key={c.id} className="flex gap-2 items-center flex-wrap text-[14px]">
            <input aria-label="Campsite fee" className="input flex-1 min-w-[140px] h-10 min-h-0" value={c.text} disabled={!canEdit} onChange={(e) => update("costs", c.id, { text: e.target.value })} placeholder="Campsite fee" />
            <input className="input w-28 h-10 min-h-0" inputMode="decimal" disabled={!canEdit} value={((c.amount ?? 0) / 100).toString()} onChange={(e) => update("costs", c.id, { amount: Math.round(parseFloat(e.target.value || "0") * 100) })} />
            <select className="input h-10 min-h-0" disabled={!canEdit} value={c.kind ?? "flat"} onChange={(e) => update("costs", c.id, { kind: e.target.value as Item["kind"] })}>
              <option value="flat">total</option><option value="per_person">per Scout</option>
            </select>
            {canEdit && <button className="btn-ghost" onClick={() => remove("costs", c.id)}>×</button>}
          </div>
        ))}
        {canEdit && <button className="btn-ghost self-start" onClick={() => add("costs", { kind: "flat", amount: 0 })}>+ Add a cost</button>}
        <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-[#EEE8D9]">
          <span>Total <b>{money(totalCost)}</b> · per Scout <b>{money(perScout)}</b> ({youthGoing || "no"} Scouts going)</span>
          {canEdit && perScout !== costCents && perScout > 0 && (
            <button className="btn-secondary" onClick={async () => {
              // This changes what every family pays, so ask first.
              if (!window.confirm(`Set the trip fee to ${money(perScout)} per person? New sign-ups pay this. Families already signed up keep their current charge unless they change their sign-up.`)) return;
              const { error } = await supabase.from("events").update({ cost_cents: perScout }).eq("id", eventId);
              if (error) setError(error.message); else router.refresh();
            }}>Set event fee to {money(perScout)}</button>
          )}
          {costCents > 0 && <Chip>Current fee {money(costCents)}</Chip>}
        </div>
      </section>

      <section className="card flex flex-col gap-2">
        <div className="font-bold text-[16px]">Itinerary</div>
        {plan.itinerary.map((i) => (
          <div key={i.id} className="flex gap-2 items-center flex-wrap">
            <input aria-label="Fri" className="input w-32 h-10 min-h-0" disabled={!canEdit} value={i.day ?? ""} onChange={(e) => update("itinerary", i.id, { day: e.target.value })} placeholder="Fri" />
            <input aria-label="5:30 PM" className="input w-28 h-10 min-h-0" disabled={!canEdit} value={i.time ?? ""} onChange={(e) => update("itinerary", i.id, { time: e.target.value })} placeholder="5:30 PM" />
            <input aria-label="Depart from church parking lot" className="input flex-1 min-w-[160px] h-10 min-h-0" disabled={!canEdit} value={i.text} onChange={(e) => update("itinerary", i.id, { text: e.target.value })} placeholder="Depart from church parking lot" />
            {canEdit && <button className="btn-ghost" onClick={() => remove("itinerary", i.id)}>×</button>}
          </div>
        ))}
        {canEdit && <button className="btn-ghost self-start" onClick={() => add("itinerary", {})}>+ Add a step</button>}
      </section>

      <section className="card flex flex-col gap-2">
        <div className="font-bold text-[16px]">Patrol meals and grocery list</div>
        <p className="text-[13px] text-smoke m-0">Patrols plan their own menus. Enter amounts per person; the list scales to who&apos;s signed up.</p>
        {patrols.map((p) => {
          const meals = plan.meals.filter((m) => m.patrol === p.id);
          return (
            <div key={p.id} className="rounded-xl bg-paper p-3 flex flex-col gap-2">
              <div className="font-bold">{p.name} <span className="text-smoke font-normal">· {p.going} going</span></div>
              {meals.map((m) => (
                <div key={m.id} className="flex gap-2 flex-wrap items-center text-[14px]">
                  <input aria-label="Sat breakfast" className="input w-32 h-9 min-h-0" value={m.meal ?? ""} onChange={(e) => update("meals", m.id, { meal: e.target.value })} placeholder="Sat breakfast" />
                  <input aria-label="Pancake mix" className="input flex-1 min-w-[140px] h-9 min-h-0" value={m.text} onChange={(e) => update("meals", m.id, { text: e.target.value })} placeholder="Pancake mix" />
                  <input aria-label="per" className="input w-20 h-9 min-h-0" inputMode="decimal" value={m.per ?? ""} onChange={(e) => update("meals", m.id, { per: parseFloat(e.target.value || "0") })} placeholder="per" />
                  <input aria-label="cups" className="input w-20 h-9 min-h-0" value={m.qty ?? ""} onChange={(e) => update("meals", m.id, { qty: e.target.value })} placeholder="cups" />
                  <Chip tone="green">Buy {Math.ceil((m.per ?? 0) * p.going * 10) / 10} {m.qty}</Chip>
                  <button className="btn-ghost" onClick={() => remove("meals", m.id)}>×</button>
                </div>
              ))}
              <button className="btn-ghost self-start text-[13px]" onClick={() => add("meals", { patrol: p.id })}>+ Add food item</button>
            </div>
          );
        })}
        {patrols.length === 0 && <span className="text-smoke text-[14px]">Create patrols first (Leaders → Patrols).</span>}
      </section>

      {dutiesEnabled && patrols.length > 0 && (
        <section className="card flex flex-col gap-3">
          <div className="font-bold text-[16px]">Patrol duty rosters</div>
          <p className="text-[13px] text-smoke m-0">Who cooks, cleans up and handles water and fire for each meal. Fill a fair rotation in one tap, then adjust.</p>
          {patrols.map((p) => {
            const rows = list("duties").filter((d) => d.patrol === p.id);
            return (
              <div key={p.id} className="rounded-xl p-3 flex flex-col gap-2" style={{ background: "#F8F5EE" }}>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-bold text-[15px] flex-1">{p.name}</span>
                  {canEdit && <button className="btn-ghost text-[13px]" onClick={() => fillRotation(p.id, p.scouts ?? [])}>{rows.length ? "Redo rotation" : "Fill a rotation"}</button>}
                </div>
                {rows.length === 0 && <span className="text-[13px] text-smoke">No duties yet.</span>}
                {rows.map((d) => (
                  <div key={d.id} className="flex gap-2 items-center flex-wrap text-[14px]">
                    <input className="input w-36 h-9 min-h-0" disabled={!canEdit} value={d.meal ?? ""} onChange={(e) => update("duties", d.id, { meal: e.target.value })} placeholder="Sat breakfast" aria-label="Meal" />
                    <select className="input w-40 h-9 min-h-0" disabled={!canEdit} value={d.text} onChange={(e) => update("duties", d.id, { text: e.target.value })} aria-label="Job">
                      {[...new Set([...JOBS, d.text].filter(Boolean))].map((j) => <option key={j} value={j}>{j}</option>)}
                    </select>
                    <select className="input flex-1 min-w-[140px] h-9 min-h-0" disabled={!canEdit} value={d.who ?? ""} onChange={(e) => update("duties", d.id, { who: e.target.value })} aria-label="Who">
                      <option value="">Who?</option>
                      {[...new Set([...(p.scouts ?? []), d.who].filter(Boolean))].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    {canEdit && <button className="btn-ghost" aria-label="Remove duty" onClick={() => remove("duties", d.id)}>×</button>}
                  </div>
                ))}
                {canEdit && <button className="btn-ghost self-start text-[13px]" onClick={() => add("duties", { patrol: p.id, text: JOBS[0] })}>+ Add a duty</button>}
              </div>
            );
          })}
        </section>
      )}

      <section className="card flex flex-col gap-2">
        <div className="font-bold text-[16px]">Packing list <span className="text-smoke text-[13px] font-normal">(families see this on the event page)</span></div>
        {canEdit && (
          <div className="flex gap-2 flex-wrap">
            {Object.keys(PACKING).map((k) => (
              <button key={k} className="btn-secondary min-h-[36px] text-[13px]" onClick={() => save({ ...plan, packing: [...plan.packing, ...PACKING[k].map((t) => ({ id: uid(), text: t }))] })}>Add {k} template</button>
            ))}
          </div>
        )}
        {plan.packing.map((p) => (
          <div key={p.id} className="flex gap-2 items-center text-[14px]">
            <span className="flex-1">{p.text}</span>
            {canEdit && <button className="btn-ghost" onClick={() => remove("packing", p.id)}>×</button>}
          </div>
        ))}
        {canEdit && (
          <div className="flex gap-2">
            <input aria-label="Add an item" className="input flex-1 h-10 min-h-0" value={draft.packing ?? ""} onChange={(e) => setDraft({ ...draft, packing: e.target.value })} placeholder="Add an item" />
            <button className="btn-secondary min-h-[40px]" disabled={!draft.packing} onClick={() => { add("packing", { text: draft.packing }); setDraft({ ...draft, packing: "" }); }}>Add</button>
          </div>
        )}
      </section>

      <section className="card flex flex-col gap-2">
        <div className="font-bold text-[16px]">Tasks</div>
        {plan.tasks.map((t) => (
          <div key={t.id} className="flex gap-2 items-center flex-wrap text-[14px]">
            <input type="checkbox" className="w-5 h-5" checked={!!t.done} disabled={!canEdit} onChange={(e) => update("tasks", t.id, { done: e.target.checked })} />
            <input aria-label="Reserve campsite" className="input flex-1 min-w-[160px] h-10 min-h-0" disabled={!canEdit} value={t.text} onChange={(e) => update("tasks", t.id, { text: e.target.value })} placeholder="Reserve campsite" />
            <select className="input h-10 min-h-0" disabled={!canEdit} value={t.who ?? ""} onChange={(e) => update("tasks", t.id, { who: e.target.value })}>
              <option value="">Unassigned</option>{adults.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <input className="input w-40 h-10 min-h-0" type="date" disabled={!canEdit} value={t.due ?? ""} onChange={(e) => update("tasks", t.id, { due: e.target.value })} />
            {t.due && !t.done && new Date(t.due) < new Date() && <Chip tone="red">Overdue</Chip>}
            {canEdit && <button className="btn-ghost" onClick={() => remove("tasks", t.id)}>×</button>}
          </div>
        ))}
        {canEdit && <button className="btn-ghost self-start" onClick={() => add("tasks", {})}>+ Add a task</button>}
      </section>

      <section className="card flex flex-col gap-2">
        <div className="font-bold text-[16px]">Safety and permits checklist</div>
        <p className="text-[13px] text-smoke m-0">Scouting America&apos;s SAFE Checklist, plus any reservations or permits this trip needs.</p>
        {plan.permits.map((p) => (
          <label key={p.id} className="flex gap-2 items-start text-[14px]">
            <input type="checkbox" className="w-5 h-5 mt-0.5" checked={!!p.done} disabled={!canEdit} onChange={(e) => update("permits", p.id, { done: e.target.checked })} />
            <span className="flex-1">{p.text}</span>
          </label>
        ))}
        {canEdit && (
          <div className="flex gap-2">
            <input aria-label="e.g. State park campsite reservation #" className="input flex-1 h-10 min-h-0" value={draft.permit ?? ""} onChange={(e) => setDraft({ ...draft, permit: e.target.value })} placeholder="e.g. State park campsite reservation #" />
            <button className="btn-secondary min-h-[40px]" disabled={!draft.permit} onClick={() => { add("permits", { text: draft.permit }); setDraft({ ...draft, permit: "" }); }}>Add</button>
          </div>
        )}
      </section>
    </div>
  );
}

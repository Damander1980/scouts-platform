"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Chip, ErrorBox, money } from "@/components/ui";

type Item = { id: string; text: string; done?: boolean; who?: string; due?: string; day?: string; time?: string; amount?: number; kind?: "per_person" | "flat"; patrol?: string; meal?: string; qty?: string; per?: number };
export type Plan = { itinerary: Item[]; costs: Item[]; meals: Item[]; packing: Item[]; tasks: Item[]; permits: Item[] };

const PACKING: Record<string, string[]> = {
  "Weekend campout": ["Scout Basic Essentials (first aid kit, water bottle, flashlight, trail food, sun protection, map and compass, rain gear, pocketknife, extra clothing, matches)", "Sleeping bag rated for the weather", "Sleeping pad", "Mess kit and utensils", "Uniform (Class A for travel)", "Toiletries", "Health form A+B on file"],
  "Summer camp": ["Everything on the weekend list", "Swimsuit and towel", "Merit badge pamphlets and prerequisites", "Laundry bag", "Health form A, B and C (physician exam)", "Spending money for trading post"],
  "Backpacking": ["Backpack fitted and under 25% of body weight", "Lightweight tent or shelter (shared)", "Stove, fuel, and pot (shared)", "Water treatment", "Bear bag or canister where required", "Leave No Trace trowel"],
};
const SAFE = ["Supervision: qualified, trained adults (two registered adults 21+ with current YPT)", "Assessment: activity and site hazards reviewed", "Fitness and skill: Scouts' health forms and skills checked", "Equipment: correct gear and safety equipment", "Environment: weather forecast and emergency plan reviewed", "Discipline: rules explained to Scouts"];
const uid = () => Math.random().toString(36).slice(2, 10);

export default function TripPlanClient({ eventId, orgId, canEdit, title, costCents, plan: initial, youthGoing, adultsGoing, seats, patrols, adults }: {
  eventId: string; orgId: string; canEdit: boolean; title: string; costCents: number; plan: Plan;
  youthGoing: number; adultsGoing: number; seats: number; patrols: { id: string; name: string; going: number }[]; adults: { id: string; name: string }[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [plan, setPlan] = useState<Plan>({ ...initial, permits: initial.permits?.length ? initial.permits : SAFE.map((t) => ({ id: uid(), text: t })) });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const people = youthGoing + adultsGoing;

  const save = async (next: Plan) => {
    setPlan(next); setSaved(false); setError("");
    if (!canEdit) return;
    const { error } = await supabase.from("trip_plans").upsert({ event_id: eventId, org_id: orgId, ...next, updated_at: new Date().toISOString() });
    if (error) setError(error.message); else setSaved(true);
  };
  const add = (k: keyof Plan, item: Partial<Item>) => save({ ...plan, [k]: [...plan[k], { id: uid(), text: "", ...item }] });
  const update = (k: keyof Plan, id: string, patch: Partial<Item>) => save({ ...plan, [k]: plan[k].map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  const remove = (k: keyof Plan, id: string) => save({ ...plan, [k]: plan[k].filter((x) => x.id !== id) });

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
            <input className="input flex-1 min-w-[140px] h-10 min-h-0" value={c.text} disabled={!canEdit} onChange={(e) => update("costs", c.id, { text: e.target.value })} placeholder="Campsite fee" />
            <input className="input w-28 h-10 min-h-0" inputMode="decimal" disabled={!canEdit} value={((c.amount ?? 0) / 100).toString()} onChange={(e) => update("costs", c.id, { amount: Math.round(parseFloat(e.target.value || "0") * 100) })} />
            <select className="input h-10 min-h-0" disabled={!canEdit} value={c.kind ?? "flat"} onChange={(e) => update("costs", c.id, { kind: e.target.value as Item["kind"] })}>
              <option value="flat">total</option><option value="per_person">per Scout</option>
            </select>
            {canEdit && <button className="btn-ghost" onClick={() => remove("costs", c.id)}>×</button>}
          </div>
        ))}
        {canEdit && <button className="btn-ghost self-start" onClick={() => add("costs", { kind: "flat", amount: 0 })}>+ Add a cost</button>}
        <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-[#EAF0ED]">
          <span>Total <b>{money(totalCost)}</b> · per Scout <b>{money(perScout)}</b> ({youthGoing || "no"} Scouts going)</span>
          {canEdit && perScout !== costCents && perScout > 0 && (
            <button className="btn-secondary" onClick={async () => {
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
            <input className="input w-32 h-10 min-h-0" disabled={!canEdit} value={i.day ?? ""} onChange={(e) => update("itinerary", i.id, { day: e.target.value })} placeholder="Fri" />
            <input className="input w-28 h-10 min-h-0" disabled={!canEdit} value={i.time ?? ""} onChange={(e) => update("itinerary", i.id, { time: e.target.value })} placeholder="5:30 PM" />
            <input className="input flex-1 min-w-[160px] h-10 min-h-0" disabled={!canEdit} value={i.text} onChange={(e) => update("itinerary", i.id, { text: e.target.value })} placeholder="Depart from church parking lot" />
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
            <div key={p.id} className="rounded-xl border border-border p-3 flex flex-col gap-2">
              <div className="font-bold">{p.name} <span className="text-smoke font-normal">· {p.going} going</span></div>
              {meals.map((m) => (
                <div key={m.id} className="flex gap-2 flex-wrap items-center text-[14px]">
                  <input className="input w-32 h-9 min-h-0" value={m.meal ?? ""} onChange={(e) => update("meals", m.id, { meal: e.target.value })} placeholder="Sat breakfast" />
                  <input className="input flex-1 min-w-[140px] h-9 min-h-0" value={m.text} onChange={(e) => update("meals", m.id, { text: e.target.value })} placeholder="Pancake mix" />
                  <input className="input w-20 h-9 min-h-0" inputMode="decimal" value={m.per ?? ""} onChange={(e) => update("meals", m.id, { per: parseFloat(e.target.value || "0") })} placeholder="per" />
                  <input className="input w-20 h-9 min-h-0" value={m.qty ?? ""} onChange={(e) => update("meals", m.id, { qty: e.target.value })} placeholder="cups" />
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
            <input className="input flex-1 h-10 min-h-0" value={draft.packing ?? ""} onChange={(e) => setDraft({ ...draft, packing: e.target.value })} placeholder="Add an item" />
            <button className="btn-secondary min-h-[40px]" disabled={!draft.packing} onClick={() => { add("packing", { text: draft.packing }); setDraft({ ...draft, packing: "" }); }}>Add</button>
          </div>
        )}
      </section>

      <section className="card flex flex-col gap-2">
        <div className="font-bold text-[16px]">Tasks</div>
        {plan.tasks.map((t) => (
          <div key={t.id} className="flex gap-2 items-center flex-wrap text-[14px]">
            <input type="checkbox" className="w-5 h-5" checked={!!t.done} disabled={!canEdit} onChange={(e) => update("tasks", t.id, { done: e.target.checked })} />
            <input className="input flex-1 min-w-[160px] h-10 min-h-0" disabled={!canEdit} value={t.text} onChange={(e) => update("tasks", t.id, { text: e.target.value })} placeholder="Reserve campsite" />
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
            <input className="input flex-1 h-10 min-h-0" value={draft.permit ?? ""} onChange={(e) => setDraft({ ...draft, permit: e.target.value })} placeholder="e.g. State park campsite reservation #" />
            <button className="btn-secondary min-h-[40px]" disabled={!draft.permit} onClick={() => { add("permits", { text: draft.permit }); setDraft({ ...draft, permit: "" }); }}>Add</button>
          </div>
        )}
      </section>
    </div>
  );
}

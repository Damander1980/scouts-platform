import ScoutHome, { type ScoutEvent } from "../../dashboard/ScoutHome";

// Sample data only: shows what a Scout sees when they sign in. Taps here don't save.
const day = (n: number, h = 19) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0); return d.toISOString(); };
const events: ScoutEvent[] = [
  { id: "d1", title: "Troop Meeting", start_at: day(2), end_at: null, location: "Church fellowship hall", kind: "meeting", cost_cents: 0, rsvp_deadline: null, mine: null },
  { id: "d2", title: "Caprock Canyon Campout", start_at: day(9, 17), end_at: day(11, 12), location: "Caprock Canyons State Park", kind: "campout", cost_cents: 4500, rsvp_deadline: null, mine: null },
  { id: "d3", title: "Food Bank Service Project", start_at: day(16, 9), end_at: null, location: "North Texas Food Bank", kind: "service", cost_cents: 0, rsvp_deadline: null, mine: { status: "going", notes: null, dietary: null, answers: {} } },
];

export default function DemoScout() {
  return <div className="min-h-screen bg-canvas p-4 max-w-xl mx-auto"><ScoutHome personId="demo" firstName="Sam" events={events} rank={{ name: "Second Class", done: 9, total: 12, complete: false }} /></div>;
}

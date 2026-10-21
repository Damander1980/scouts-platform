import RecharterClient, { type Person } from "@/app/admin/recharter/RecharterClient";

// Sample data only; the checklist is read-only here because there is no real unit behind it.
const people: Person[] = [
  { id: "1", name: "Floyd Kobler", last: "Kobler", type: "adult", role: "Scoutmaster", ypt: "2027-03-01", reg: "2026-12-31" },
  { id: "2", name: "Dana Brooks", last: "Brooks", type: "adult", role: "Committee Chair", ypt: "2026-11-15", reg: "2026-12-31" },
  { id: "3", name: "Tom Garcia", last: "Garcia", type: "adult", role: "Parent/Guardian", ypt: null, reg: null },
  { id: "4", name: "Emma Chen", last: "Chen", type: "youth", role: "Scout", ypt: null, reg: "2026-12-31" },
  { id: "5", name: "Jake Garcia", last: "Garcia", type: "youth", role: "Scout", ypt: null, reg: "2027-12-31" },
];

export default function DemoRecharter() {
  return (
    <div className="min-h-screen bg-canvas p-4 max-w-4xl mx-auto">
      <RecharterClient orgId="demo" year={2027} canEdit={false} people={people}
        recharter={{ id: "d", items: { roster: { done: true, at: "2026-10-12T12:00:00Z" }, key3: { done: true, at: "2026-10-14T12:00:00Z" } }, notes: null, due_on: null, submitted_at: null }} />
    </div>
  );
}

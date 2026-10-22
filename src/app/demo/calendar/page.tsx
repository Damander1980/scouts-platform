import AppShell from "@/components/AppShell";
import { PageTitle } from "@/components/ui";
import MonthGrid from "../../events/MonthGrid";

// Sample month calendar with made-up events. Nothing here saves.
export default function DemoCalendar() {
  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  const at = (day: number, hourUtc: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day, hourUtc)).toISOString();
  const ev = (id: string, title: string, kind: string, start: string, end: string | null, org = "demo") => ({ id, title, kind, start_at: start, end_at: end, canceled: false, org_id: org });
  const events = [
    ...[1, 8, 15, 22, 29].map((d) => ev(`m${d}`, "Troop meeting", "meeting", at(d + 1, 0), at(d + 1, 1))),
    ev("camp", "Caprock Canyons campout", "campout", at(9, 22), at(11, 17)),
    ev("svc", "Food bank service project", "service", at(17, 14), at(17, 17)),
    ev("plc", "PLC meeting", "meeting", at(4, 1), at(4, 2)),
    ev("girls", "Troop 1999 campfire program", "event", at(20, 23), at(21, 1), "linked"),
    ev("coh", "Court of Honor", "event", at(27, 0), at(27, 2)),
  ];
  return (
    <AppShell orgName="Troop 999" orgs={[{ id: "demo", label: "Troop 999" }]} currentOrgId="demo" initials="TG" isLeader demo>
      <PageTitle title="Events" sub="Month view. Gold items come from a linked troop (here, the sister girls' troop)." />
      <MonthGrid month={month} events={events} ownOrg="demo" />
    </AppShell>
  );
}

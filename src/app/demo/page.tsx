import DashboardClient from "../dashboard/DashboardClient";

const fakePerson = { id: "1", first_name: "Floyd", last_name: "Kobler", type: "adult" };

const fakeOrg = {
  id: "1", name: "Troop 999", type: "scouts_bsa",
  unit_number: "999", city: "Plano, TX", join_code: "TRP999PL",
};

const fakeEvents = [
  {
    id: "e1", title: "Troop Meeting", start_at: new Date(Date.now() + 4 * 86400000).toISOString(),
    end_at: null, location: "Charter Org", cost_cents: 0, rsvpStatus: "going",
  },
  {
    id: "e2", title: "Caprock Campout", start_at: new Date(Date.now() + 5 * 86400000).toISOString(),
    end_at: null, location: "Caprock Canyon SP", cost_cents: 4500, rsvpStatus: "going",
  },
  {
    id: "e3", title: "Service Project", start_at: new Date(Date.now() + 20 * 86400000).toISOString(),
    end_at: null, location: "Food Bank", cost_cents: 0, rsvpStatus: null,
  },
];

const fakeActionItems = [
  { id: "e2", title: "Pay for Caprock Campout", amount: 4500, due: fakeEvents[1].start_at },
];

export default function DemoPage() {
  return (
    <DashboardClient
      person={fakePerson}
      org={fakeOrg}
      role="scoutmaster"
      events={fakeEvents}
      actionItems={fakeActionItems}
      balanceCents={4500}
    />
  );
}

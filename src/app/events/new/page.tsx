import { requirePerm } from "@/lib/context";
import Shell from "@/components/Shell";
import EventForm from "@/components/EventForm";
import { PageTitle } from "@/components/ui";

export default async function NewEventPage() {
  const ctx = await requirePerm("leader", "events.manage");
  return (
    <Shell ctx={ctx}>
      <PageTitle title="New event" sub="Families get the link right away and can RSVP and pay in one step." />
      <EventForm orgId={ctx.current.org.id} />
    </Shell>
  );
}

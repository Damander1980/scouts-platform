import { notFound } from "next/navigation";
import { requireLeader } from "@/lib/context";
import Shell from "@/components/Shell";
import EventForm, { type EventInput } from "@/components/EventForm";
import { PageTitle } from "@/components/ui";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireLeader();
  const { data: ev } = await ctx.supabase.from("events").select("*").eq("id", id).eq("org_id", ctx.current.org.id).maybeSingle();
  if (!ev) notFound();
  return (
    <Shell ctx={ctx}>
      <PageTitle title="Edit event" sub="Changing the cost does not re-charge families who already signed up." />
      <EventForm orgId={ctx.current.org.id} initial={ev as EventInput} />
    </Shell>
  );
}

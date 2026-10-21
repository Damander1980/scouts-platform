import { requirePerm } from "@/lib/context";
import Shell from "@/components/Shell";
import EventForm, { type EventInput } from "@/components/EventForm";
import { PageTitle } from "@/components/ui";
import CopyPicker from "./CopyPicker";

// ?copy=<event id> starts from an earlier event: every detail carries over except the dates.
export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ copy?: string }> }) {
  const { copy } = await searchParams;
  const ctx = await requirePerm("leader", "events.manage");
  const orgId = ctx.current.org.id;
  const [{ data: source }, { data: recent }] = await Promise.all([
    copy ? ctx.supabase.from("events").select("*").eq("id", copy).eq("org_id", orgId).maybeSingle() : Promise.resolve({ data: null }),
    ctx.supabase.from("events").select("id, title, start_at").eq("org_id", orgId).order("start_at", { ascending: false }).limit(30),
  ]);
  const initial = source ? ({ ...(source as EventInput), id: undefined, start_at: "", end_at: null, rsvp_deadline: null } as EventInput) : undefined;
  return (
    <Shell ctx={ctx}>
      <PageTitle title={source ? `New event from ${source.title}` : "New event"} sub={source ? "Everything is copied except the dates. Set the new dates below." : "Families get the link right away and can RSVP and pay in one step."} />
      {(recent ?? []).length > 0 && <CopyPicker events={(recent ?? []) as { id: string; title: string; start_at: string }[]} current={copy ?? ""} />}
      <EventForm key={copy ?? "blank"} orgId={orgId} initial={initial} />
    </Shell>
  );
}

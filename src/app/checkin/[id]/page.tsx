import { redirect } from "next/navigation";
import { getContext } from "@/lib/context";
import { loadFamily } from "@/lib/family";
import CheckinClient from "./CheckinClient";

export default async function CheckinPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ c?: string }> }) {
  const { id } = await params;
  const { c } = await searchParams;
  const ctx = await getContext();
  if (!ctx.person) redirect(`/welcome`);
  const { data: ev } = await ctx.supabase.from("events").select("id, title, org_id, start_at").eq("id", id).maybeSingle();
  if (!ev) return <div className="min-h-screen flex items-center justify-center p-6"><div className="card">You&apos;re not a member of this unit, or the event was removed.</div></div>;
  const family = (await loadFamily(ctx.supabase, ev.org_id)).filter((f) => f.in_org);
  return <CheckinClient eventId={id} code={c ?? ""} title={ev.title} family={family.map((f) => ({ id: f.id, name: f.first_name }))} />;
}

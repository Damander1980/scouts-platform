import type { ReactNode } from "react";
import AppShell from "./AppShell";
import { unitWord, type Membership } from "@/lib/context";

export function orgLabel(org: Membership["org"]) {
  return `${unitWord(org.type)} ${org.unit_number ?? ""}${org.city ? ` · ${org.city}` : ""}`.replace(/\s+·/, " ·").trim();
}

// Server wrapper: pulls the unread count and renders the app frame.
export default async function Shell({ ctx, children }: {
  ctx: {
    supabase: import("@supabase/supabase-js").SupabaseClient;
    person: { id: string; first_name: string; last_name: string };
    memberships: Membership[]; current: Membership; isLeader: boolean; isStaff?: boolean;
  };
  children: ReactNode;
}) {
  const { count } = await ctx.supabase
    .from("message_recipients").select("*", { count: "exact", head: true })
    .eq("person_id", ctx.person.id).is("read_at", null);

  return (
    <AppShell
      orgName={orgLabel(ctx.current.org)}
      orgs={ctx.memberships.map((m) => ({ id: m.org.id, label: orgLabel(m.org) }))}
      currentOrgId={ctx.current.org.id}
      initials={`${ctx.person.first_name[0] ?? ""}${ctx.person.last_name[0] ?? ""}`.toUpperCase()}
      isLeader={ctx.isStaff ?? ctx.isLeader}
      unread={count ?? 0}
    >
      {children}
    </AppShell>
  );
}

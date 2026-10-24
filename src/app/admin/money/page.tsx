import { requirePerm } from "@/lib/context";
import { paymentsEnabled } from "@/lib/stripe";
import MoneyClient from "./MoneyClient";

export default async function MoneyPage({ searchParams }: { searchParams: Promise<{ tab?: string; connect?: string }> }) {
  const { tab, connect } = await searchParams;
  const { supabase, current, person } = await requirePerm("money.view", "money.manage", "fundraising.manage");
  const orgId = current.org.id;

  const year = new Date().getFullYear();
  const [
    { data: isTreasurer }, { data: balances }, { data: households }, { data: expenses }, { data: budgets },
    { data: duesPlans }, { data: tx }, { data: campaigns }, { data: goals }, { data: donations }, { data: fundraisers }, { data: sales }, { data: org }, { data: scouts },
  ] = await Promise.all([
    supabase.rpc("is_treasurer", { org: orgId }),
    supabase.rpc("unit_balances", { p_org: orgId }),
    supabase.rpc("unit_households", { p_org: orgId }),
    supabase.from("expense_requests").select("id, requested_by, category, amount_cents, description, receipt_path, status, created_at, approved_by, events(title)").eq("org_id", orgId).order("created_at", { ascending: false }).limit(100),
    supabase.from("budgets").select("id, fiscal_year, starts_on, ends_on, approved_at, alert_pct, budget_lines(id, kind, category, planned_cents)").eq("org_id", orgId).order("starts_on", { ascending: false }),
    supabase.from("dues_plans").select("*").eq("org_id", orgId).order("created_at", { ascending: false }),
    supabase.from("unit_transactions").select("kind, category, amount_cents, occurred_on").eq("org_id", orgId).gte("occurred_on", `${year - 1}-01-01`),
    supabase.from("donation_campaigns").select("id, slug, title, description, target_cents, active, goal_id").eq("org_id", orgId).order("created_at", { ascending: false }),
    supabase.from("fundraising_goals").select("id, title, description, target_cents, deadline, is_public").eq("org_id", orgId).order("created_at", { ascending: false }),
    supabase.from("donations").select("*").eq("org_id", orgId),
    supabase.from("fundraisers").select("id, name, goal_id, target_cents, scout_share_pct, starts_on, ends_on, money_earning_approved_on").eq("org_id", orgId).order("created_at", { ascending: false }),
    supabase.from("fundraiser_sales").select("fundraiser_id, scout_id, amount_cents").eq("org_id", orgId),
    supabase.rpc("public_unit", { p_slug: current.org.slug }),
    supabase.from("memberships").select("person_id, persons(first_name, last_name, type)").eq("org_id", orgId).eq("status", "active"),
  ]);

  const people = ((scouts ?? []) as unknown as { person_id: string; persons: { first_name: string; last_name: string; type: string } }[]);
  const nameOf = Object.fromEntries(people.map((p) => [p.person_id, `${p.persons.first_name} ${p.persons.last_name}`]));
  const { data: stripeRow } = await supabase.from("organizations").select("stripe_account_id").eq("id", orgId).maybeSingle();
  void org;

  return (
    <MoneyClient
      orgId={orgId}
      myPersonId={person.id}
      isTreasurer={!!isTreasurer}
      paymentsConfigured={paymentsEnabled()}
      stripeConnected={!!stripeRow?.stripe_account_id}
      connectState={connect ?? null}
      initialTab={tab ?? "balances"}
      balances={(balances ?? []) as { household_id: string; household_name: string; balance_cents: number; charges: number; paid: number; last_activity: string }[]}
      households={(households ?? []) as { household_id: string; household_name: string; members: string }[]}
      expenses={(expenses ?? []).map((e) => ({ ...e, requester: nameOf[e.requested_by] ?? "Member", event: (e.events as unknown as { title: string } | null)?.title ?? null }))}
      budgets={(budgets ?? []) as unknown as { id: string; fiscal_year: string; starts_on: string; ends_on: string; approved_at: string | null; alert_pct: number; budget_lines: { id: string; kind: string; category: string; planned_cents: number }[] }[]}
      transactions={tx ?? []}
      duesPlans={duesPlans ?? []}
      campaigns={campaigns ?? []}
      goals={goals ?? []}
      // select("*") so this works before migration 0057 adds refunded_cents.
      donations={(donations ?? []).map((d) => ({ campaign_id: d.campaign_id, source: d.source, created_at: d.created_at, amount_cents: d.amount_cents - (d.refunded_cents ?? 0) }))}
      fundraisers={fundraisers ?? []}
      sales={sales ?? []}
      scouts={people.filter((p) => p.persons.type === "youth").map((p) => ({ id: p.person_id, name: nameOf[p.person_id] }))}
    />
  );
}

# Troop platform (working name TBD)

Web-first multi-troop platform for Scouting units, competing with TroopWebHost. First test: Troop 999, Plano, Texas.

- Read SPEC.md first. It is the source of truth (roles, communication/youth protection, finance on Stripe, SMS rules, roster visibility, fundraising goals, roadmap).
- prototype/ holds the design prototype (.dc.html screens, sample data only). Palette: ink #14211B, forest #1F5F4A, orange #FF6A1A, mist #EAF0ED, paper #F4F6F5; fonts Bricolage Grotesque + DM Sans. Minimum 44px touch targets.
- Proposed stack: Next.js + Postgres/Supabase (row-level security per organization), Stripe Connect + Billing, Resend/Twilio, Vercel, installable PWA. No native app.

Decisions made (Floyd): flat $125/year per unit; no live Scoutbook sync (import/export only); all messages to Scouts logged and copied to leaders AND parents; only parents can request message deletion; roster visible to all members, contact details opt-in per family; everyone can download blank medical forms, nobody uploads, leaders mark received (status only); Scouts 13+ do most things themselves; all money through Stripe.

Open: product name/domain not decided; lawyer review of deletion vs. children's privacy; verify Scoutbook import findings with Troop 999 leaders.

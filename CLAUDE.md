# Troop platform (working name TBD)

Web-first multi-troop platform for Scouting units, competing with TroopWebHost. First test: Troop 999, Plano, Texas.

- Read SPEC.md first. It is the source of truth (roles, communication/youth protection, finance on Stripe, SMS rules, roster visibility, fundraising goals, roadmap).
- prototype/ holds the design prototype (.dc.html screens, sample data only). Palette: ink #14211B, forest #1F5F4A, orange #FF6A1A, mist #EAF0ED, paper #F4F6F5; fonts Bricolage Grotesque + DM Sans. Minimum 44px touch targets.
- Proposed stack: Next.js + Postgres/Supabase (row-level security per organization), Stripe Connect + Billing, Resend/Twilio, Vercel, installable PWA. No native app.

Decisions made (Floyd): flat $125/year per unit; two-way Scoutbook sync wanted (2026-10-21; approach and Scouting America terms still to confirm, never store Scoutbook passwords); all messages to Scouts logged and copied to leaders AND parents; only parents can request message deletion, no lawyer gate (Floyd 2026-10-21); roster visible to all members, contact details opt-in per family; everyone can download blank medical forms, nobody uploads, leaders mark received (status only); every Scout has their own account (under-13 created with parent consent); Scouts 13+ do most things themselves; online payments go through Stripe, and cash or checks are always allowed (treasurer records them, no fee).

More decisions 2026-10-21: troop chooses whether families or the troop pay card fees; troop chooses which payment methods it accepts (Stripe, cash/check or both); every payer is an individual account and parents can pay for their kids, including on linked-unit events; unit admins also need current YPT to see private kid data; two-step verification required for admins, leaders and treasurers; 30-day free trial; Scouts BSA first, other programs later; support reply within 24-48 business hours; no setup-time numbers in marketing.

Open: product name/domain not decided; verify Scoutbook import findings with Troop 999 leaders.

# Our Troop Manager

Web-first multi-troop platform for Scouting units, competing with TroopWebHost. First test: Troop 999, Plano, Texas.

- Read SPEC.md first. It is the source of truth (roles, communication/youth protection, finance on Stripe, SMS rules, roster visibility, fundraising goals, roadmap).
- prototype/ holds the design prototype (.dc.html screens, sample data only). Palette: ink #14211B, forest #1F5F4A, orange #FF6A1A, mist #EAF0ED, paper #F4F6F5; fonts Bricolage Grotesque + DM Sans. Minimum 44px touch targets.
- Proposed stack: Next.js + Postgres/Supabase (row-level security per organization), Stripe Connect + Billing, Resend/Twilio, Cloudflare Workers, installable PWA, plus native iOS and Android apps (Capacitor shell around the live site, adding push notifications) (Floyd, 2026-10-24).

Decisions made (Floyd): flat $125/year per unit; two-way Scoutbook sync wanted (2026-10-21): server signs in with a leader's stored Scoutbook login, encrypted, opt-in per leader, revocable; Scouting America terms still to confirm; all messages to Scouts logged and copied to parents; leaders copied only on direct adult-to-Scout messages and read the rest in the Message log (Floyd 2026-10-24); only parents can request message deletion, no lawyer gate (Floyd 2026-10-21); roster visible to all members, contact details opt-in per family; everyone can download blank medical forms, nobody uploads, leaders mark received (status only); every Scout has their own account (under-13 created with parent consent); Scouts 13+ do most things themselves; online payments go through Stripe, and cash or checks are always allowed (treasurer records them, no fee).

More decisions 2026-10-21: troop chooses whether families or the troop pay card fees; troop chooses which payment methods it accepts (Stripe, cash/check or both); every payer is an individual account and parents can pay for their kids, including on linked-unit events; unit admins also need current YPT to see private kid data; two-step verification required for admins, leaders and treasurers; 30-day free trial; Scouts BSA troops only (Cub, Venturing, Sea Scout, Trail Life and AHG code removed 2026-10-21; add back later as separate work); support reply within 24-48 business hours; no setup-time numbers in marketing.

Domain: ourtroopmanager.com registered (Floyd, 2026-10-23). Product name: Our Troop Manager (Floyd, 2026-10-23). Open: verify Scoutbook import findings with Troop 999 leaders.

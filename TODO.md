# TODO

Work that needs Floyd's input, accounts, keys, or a real device.
Claude handles everything else directly without asking.

---

## Needs Floyd

### Accounts / Keys (do these first — blocks everything else)
- [ ] **Supabase project** — create a new project at supabase.com, grab the Project URL and anon key, paste them here so Claude can wire up `.env.local`
- [ ] **GitHub repo** — create a repo under account `Damander1980` named `scouts-platform` (public or private), then Claude will push
- [ ] **Vercel account** — connect GitHub repo to Vercel for auto-deploy on push to `main`
- [ ] **Stripe account** — needed for Phase 2 (event payments). Not blocking Phase 1.
- [ ] **Resend account** — needed for magic-link email auth. Not blocking until auth is wired.
- [ ] **Twilio account** — needed for SMS notifications. Phase 2.

### Positions & permissions (LIVE 2026-10-19)
- [ ] **Decide: should unit admins also need current YPT** to see private kid data? Right now admins are exempt so a brand-new unit can be set up. Safer, but a new troop gets stuck until someone enters a YPT date.
- [ ] **Enter YPT dates for current leaders** after the push. Leaders without one lose private details, health form status and the message log (other tools keep working), and the app shows them why.

### Product decisions
- [ ] App name / domain — "ScoutPlatform" is the placeholder. What should it be called?
- [ ] Subscription price confirmed at $125/yr per troop?
- [ ] For Troop 999 onboarding: do you have a Scoutbook export file to test the import with?

---

## In Progress (Claude is working on this)
- [x] Scaffold Next.js + TypeScript + Tailwind
- [x] Design tokens (ink/forest/orange/mist/paper palette)
- [x] Supabase client wiring (browser + server + middleware)
- [ ] DB migrations — all 10 core tables + RLS
- [ ] Auth pages (magic link + Google)
- [ ] Setup wizard (3-step troop onboarding, matches Start.dc.html)
- [ ] Parent home screen (matches Main.dc.html)
- [ ] RSVP + pay flow (matches Rsvp.dc.html)
- [ ] Leader roster (matches Roster.dc.html)
- [ ] PWA manifest + service worker

---

## Backlog (Phase 2+)
- [ ] Stripe Connect — troop stripe accounts for event payments
- [ ] Stripe Billing — $125/yr platform subscription
- [ ] Scoutbook CSV import parser
- [ ] SMS opt-in flow (Twilio, adults only)
- [ ] Email notifications (Resend)
- [ ] Mobile app (React Native / Expo) — web ships first
- [ ] Tour permit PDF export
- [ ] Advancement tracking (ranks, merit badges)
- [ ] Treasurer reports
- [ ] Multi-troop admin portal

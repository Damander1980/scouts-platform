# TODO

Work that needs Floyd's input, accounts, keys, or a real device.
Claude handles everything else directly without asking.

Build order (Floyd, 2026-10-19): **PC web platform first, then the app, iOS last.**

---

## Needs Floyd

### Start here (2026-10-21)
- [ ] **Sign in:** `node scripts/set-password.mjs fdkobler@gmail.com` (you type the password).
- [ ] **Sample troop to click around in:** `node scripts/seed-demo.mjs fdkobler@gmail.com`
      (fake families, events, sign-ups, forms, balances; `--remove` deletes it).
- [ ] **Push migrations 0042-0049** (`npx supabase db push`): 0042 admins need current YPT and
      private kid data needs a two-step session; 0043 Scoutbook upload tracking; 0044 linked-unit
      sign-ups; 0045 encrypted Scoutbook login storage (UI stays hidden until NEXT_PUBLIC_SCOUTBOOK_SYNC=on); 0046 Eagle project tracker; 0047 Patrol Leaders' Council space; 0048 trip duty rosters; 0049 message families who owe.
      Until pushed, those features stay hidden or fall back to the old behavior.
- [ ] First time in Leader tools you'll set up two-step sign-in with an authenticator app.

### Before pitching Troop 999
- [ ] **Host it** (Vercel login) and add Stripe/Resend keys: leaders can't evaluate a site that only runs on this PC, or a pay button that can't pay.
- [x] Trial terms: 30 days free (Floyd, 2026-10-21).
- [ ] Get a real TroopWebHost export from a Troop 999 admin (roster Excel/CSV, and the Internet Advancement file from Advancement > Recognize recent achievements). Column names are unverified, so the importer may need tuning.
- [ ] **Two-way Scoutbook sync** (decided 2026-10-21, stored leader login): needs a sanitized browser capture (HAR) from a Key 3 / advancement chair login viewing roster, a Scout profile, a rank and merit badges. Check Scouting America's terms first.
- [x] Linked-unit sign-ups: charge goes on the guest's family account in their own unit (built, 0044).
- [ ] Pick a product name and domain.

### Push / deploy
- [x] Migrations 0036-0041 pushed and all code pushed to GitHub.
- [ ] **The site is not hosted anywhere yet.** The repo has no Vercel deployments.
      Connect Vercel to `Damander1980/scouts-platform` so pushes go live. Until
      then, view on a phone on home Wi-Fi at `http://<this PC's IP>:3000/demo/tour`.
- [ ] Note: an old unused `site_pages` table (0016, 0 rows) is still on the
      database. The builder uses `web_pages`. Safe to drop later if wanted.
- [ ] Forums and linked units weren't tested with real data (forum posts are
      permanent; linking needs a second unit).
- [ ] **Twilio**: point the number's incoming-message webhook at
      `/api/sms/inbound` once the account exists.

### Positions & permissions (LIVE 2026-10-19)
- [ ] **Decide: should unit admins also need current YPT** to see private kid
      data? Right now admins are exempt so a brand-new unit can be set up.
      Safer, but a new troop gets stuck until someone enters a YPT date.
- [ ] **Enter YPT dates for current leaders** after the push. Leaders without
      one lose private details, health form status and the message log (other
      tools keep working), and the app shows them why.

### Accounts / keys (code is built, keys not in `.env.local`)
- [ ] **Stripe** — checkout + Connect routes exist (`src/app/api/stripe/`).
      Needs the account and keys before any troop can take money.
- [ ] **Resend** — email sending is wired (`src/lib/notify.ts`,
      `messageEmail.ts`). Needs the account and key.
- [ ] **Twilio** — SMS is wired in `notify.ts`. Needs the account and key.

### Product decisions
- [ ] **Linked units: combined sign-ups.** Shared calendar is built. Letting a
      linked unit's family sign up and pay needs a call: whose ledger gets the
      charge, and does the host unit see the other unit's kids?
- [ ] **Offline sign-offs at camp.** Attendance and the trip sheet work offline;
      advancement sign-offs don't yet. Wanted?
- [ ] App name / domain — still a placeholder.
- [ ] Subscription price confirmed at $125/yr per troop?
- [ ] Troop 999: a real Scoutbook export file to test the import with, and
      confirm the import findings with their leaders.
- [ ] Lawyer review: message deletion vs. children's privacy.

---

## Built (as of 2026-10-19, migrations 0001-0035)
Auth + setup, parent/scout home, events + RSVP + pay, roster import, family
accounts with parent-consented child logins, advancement + counselor dashboard,
trip planning, attendance, patrols, gear and documents, forms (status only),
message log, volunteer shifts and polls, yearly dues, fundraising/give page,
exports, reminders cron, installable app (PWA), positions/permissions with YPT
lockdown.
Added 2026-10-19: treasurer reports (monthly/year-end), printable trip sheet
(replaces the retired tour permit, opens offline), Court of Honor shopping
list + program, recharter helper, adult skills inventory, linked units
(shared calendar), discussion boards, text STOP/HELP webhook + opt-in
confirmation text, website builder (block pages, draft/publish, history).

---

## Built 2026-10-21 (all pushed to GitHub)
Redesign: navy/gold/sand, floating cards, Scoutbook-style shell, 7-section leader sidebar, new
landing page, demo tour (incl. month calendar), Safety and privacy page. Email+password or Google
sign-in, two-step for leader tools. Payment settings (methods, who pays card fee). Members,
Money, Overview, Events (list + month), event page, event form, Forms, Messages, Family, Pay,
counselor, setup, welcome and join pages simplified. Scoutbook upload tracking. Linked-unit
sign-ups. Scout RSVP setting enforced with parent approval and notice. Eagle project tracker. PLC
space. Trip duty rosters. Copy an event (with trip plan). Single-event calendar file, Directions.
Message families who owe. Bulk advancement sign-off. Health form and YPT expiry reminders. Activity
log for admins. Find-a-member search. Invite message by email. Donors choose to cover the fee.
Time-zone fix (server UTC). Tests: `npm test` (vitest), 25 passing.

## Backlog
- [ ] Verify every money path end to end once Stripe keys exist (test mode).
- [ ] Multi-troop admin portal
- [ ] Mobile app — after web is done; iOS submission last.

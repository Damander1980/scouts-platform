# TODO

Work that needs Floyd's input, accounts, keys, or a real device.
Claude handles everything else directly without asking.

Build order (Floyd, 2026-10-19): **PC web platform first, then the app, iOS last.**

---

## Needs Floyd

### Push / deploy
- [ ] **Migrations 0036-0040 not on the database yet** (recharter, adult skills,
      linked units, forums, website pages). Dry run 2026-10-19 lists exactly these
      five. Push them BEFORE deploying the code: the event form now saves
      `share_linked`, so posting an event fails until 0038 is live.
- [ ] **Twilio**: point the number's incoming-message webhook at
      `/api/sms/inbound` once the account exists.
- [ ] **Local commits not pushed** to `Damander1980/scouts-platform`
      (`ea6f3b7` positions + youth-data lockdown, `6d3ca7f` roster import YPT
      dates). Migrations 0034 and 0035 are already live on the database, so
      the live site is running old code against the new database until these
      go up.

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

## Backlog
- [ ] Verify every money path end to end once Stripe keys exist (test mode).
- [ ] Multi-troop admin portal
- [ ] Mobile app — after web is done; iOS submission last.

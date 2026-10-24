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
- [ ] **Push migrations 0042-0063** (`npx supabase db push`): 0042 admins need current YPT and
      private kid data needs a two-step session; 0043 Scoutbook upload tracking; 0044 linked-unit
      sign-ups; 0045 encrypted Scoutbook login storage (UI stays hidden until NEXT_PUBLIC_SCOUTBOOK_SYNC=on); 0046 Eagle project tracker; 0047 Patrol Leaders' Council space; 0048 trip duty rosters; 0049 message families who owe; 0050 merge duplicate people; 0051 Scoutbook activity log import; 0052 database hardening; 0053 sign-up/waitlist fixes; 0054 notices sent once; 0055 cross-troop security guards (important); 0056 message guards; 0057-0058 money fixes; 0059 public site guards; 0060 import/attendance fixes; 0061 Eagle/PLC guards; 0062 advancement sign-off guards (important); 0063 memberships can't be repointed (important), patrol guard, new phone needs new SMS consent.
      0077 dues messages go to the families a charge is for; 0076 charge categories (dues, camp, gear, fees); 0075 starting a troop no longer floods the activity log; 0074 one troop per founder (owner exempt); 0073 sign-ups read-only outside the sign-up function, allergy notes and answers private to family and event leaders; 0072 skill modules and sessions for Trail to First Class; 0071 goes-by name, pronouns, registration gender and private tent/cabin note; 0070 claim and family codes: secure, 14-day expiry, 10 tries an hour; 0069 finished events closed to family sign-ups and cancels, weekly series keep all event details; 0068 email holds (set RESEND_WEBHOOK_SECRET and add a Resend webhook to /api/webhooks/resend for email.bounced and email.complained); 0067 review fixes (merge keeps approver, import skips undated rows); 0066 message groups (all Scouts, all parents, all adults); 0065 tetanus and swim-check dates on Forms & safety; 0064 platform owner view at /platform (all troops and users; kids first name + last initial).
      Until pushed, those features stay hidden or fall back to the old behavior.
- [ ] First time in Leader tools you'll set up two-step sign-in with an authenticator app.

### Before pitching Troop 999
- [ ] **Host it** (Vercel login) and add Stripe/Resend keys: leaders can't evaluate a site that only runs on this PC, or a pay button that can't pay.
- [x] Trial terms: 30 days free (Floyd, 2026-10-21).
- [ ] Get a real TroopWebHost export from a Troop 999 admin (roster Excel/CSV, and the Internet Advancement file from Advancement > Recognize recent achievements). Column names are unverified, so the importer may need tuning.
- [ ] **Two-way Scoutbook sync** (decided 2026-10-21, stored leader login): needs a sanitized browser capture (HAR) from a Key 3 / advancement chair login viewing roster, a Scout profile, a rank and merit badges. Check Scouting America's terms first.
- [x] Linked-unit sign-ups: charge goes on the guest's family account in their own unit (built, 0044).
- [x] Domain: ourtroopmanager.com (2026-10-23). Point it at the Vercel project, then set NEXT_PUBLIC_SITE_URL and verify the domain in Resend (SPF/DKIM) so email sends from it.
- [x] Product name: Our Troop Manager (renamed 2026-10-23).

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
- [ ] **Deletion requests are recorded but never carried out** (found 2026-10-22). Parents are told
      deletion is scheduled; nothing runs it. Needs a call: what happens to the permanent message log
      and forum posts when a family is deleted (remove names? keep a sealed copy for youth protection?).
- [ ] **YPT dates are self-reported.** An admin with lapsed YPT can type a new date on their own
      membership. Options: only another admin can change it, or import it from Scoutbook. Your call.
- [ ] **Album photos live in a public storage bucket.** The site hides photos of Scouts without photo
      consent, but anyone with the file's address can still open it. Fix is a private bucket with signed
      links (moderate work); say if you want it before Troop 999 uploads photos.
- [ ] **Two-step sign-in protects pages, not the database.** Someone with a stolen admin password (no
      authenticator code) could still change roles or money by calling the database directly. Fix: require
      a two-step session in the admin/money database rules. Needs testing with a real login; say go.
- [ ] **Anyone can start unlimited units for free.** That's what makes cross-troop attacks cheap. A cap
      per person (or troop type = Scouts BSA only, card on file after the trial) would help.
- [ ] Two checkout tabs (or both parents paying at once) can overpay; the extra becomes a family credit.
      Fine to leave, or block a second open checkout per family?

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

### Later
- [ ] /platform reads the people list 1000 rows per call and logs a view per page; give platform_people offset/limit args and one log per visit once there are thousands of members.

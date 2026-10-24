# Scout Manager demo walkthrough (2026-10-23)

Source: scoutmanager.com demo troop (resets nightly). Walked every page and the create/edit flows; no emails sent, no passwords set.

## What I did there
Added a Scout (patrol required) and an adult, edited the adult (health dates, employer, city), created a patrol, gave a leader role, added a PLC position, created an event with invitee groups and a camping activity, RSVP'd and marked attendance, applied activity credits, signed off Scout rank requirements, created a money account, made a deposit, archived and restored the adult.

## Worth borrowing
- Scout card: patrol, rank, age, Edit and Advancement buttons in one row.
- One profile page per Scout: personal info, health dates, swim ability, connected parents, account balance, awards.
- Health forms and swim checks report: Part A/B/C expiry, tetanus, swim check, swim ability; filters for expiring in 30/60/90 days; PDF and print.
- Email recipients by smart group (Everyone, Adults, Scouts, Parents, Leaders, Treasurers, each patrol) with live counts; distribution lists can embed smart groups so they stay current.
- Events: invitees are groups resolved at reminder time (late joiners included); activities (camping nights, service hours, hiking miles) credited to attendees with one Apply Credits; carpool summary (drivers, seats short); event roster PDF with chosen fields; two reminders (1-30 days before); ICS export; recurrence.
- Events dashboard by quarter/6 months/year: attendance, charged, credits applied, activity totals.
- Advancement: current requirement text with a checkbox and sign-off date per requirement; Quick Complete; Eagle-required badges with "choose one" groups; Eagle tracker (eligible, time to 18) with CSV/PDF; award ordering and distribution report with labels.
- PLC positions say which ranks they count toward (Star/Life/Eagle) and track months in role.
- Archive keeps history; Restore asks Adult or Scout.
- Audit log filters by date, action and record type; logged everything I did.
- Accounting: Asset/Expense/Revenue/Liability/Member accounts, deposit/transfer/payment/charge-many, treasurer summary, income and expense, per-Scout ledger.
- Email deliverability page: who has no email and no reachable guardian, with a diagnose button.

## Weak spots (our edge)
- Archiving removes roles and links; Restore does not bring them back (Pat lost Event Coordinator).
- Add Adult has an empty role list; Add Scout requires a patrol.
- Nothing on YPT, two-step sign-in, or hiding kids' birthdays from other adults.
- No online payments; accounts are bookkeeping only.
- Join is leader-adds or CSV import (columns: firstName, lastName, email, memberType, subunitName, dateOfBirth, phone, username). No invite link or join requests.
- Email needs a verified address; demo had none on file for 24 of 24 members.
- Desktop admin layout; narrow screens stack awkwardly.
- Role dialogs defaulted to the first person and Administrator, which made an accidental admin grant easy (it happened to me once; fixed).

## Not tested
CSV import upload, newsletter send, send email, Set Password, Invite (all send mail or touch credentials).

---

# Scout Manager docs (read all 45 pages, 2026-10-23)

## Corrections to what I first reported
- Their "Parent Sign-off", "Balance-based RSVP" and "Users Use Bcc" settings do nothing yet (their own docs say so). Not real competition.
- "Copy Parents" only CCs a parent when an email goes to a Scout, and is off by default.
- Their archive removes roles, patrol, parent links and account links, and Restore only brings back Adult/Scout and a patrol. Ours keeps everything.

## How they run the business
- $9.95/month or $108/year (about $9/month), every feature included, billed through Stripe. Ours: flat $125/year per unit.
- Expired or unpaid subscription locks the whole unit (not read-only). Data is kept.
- New units can only send 10 emails in the first 24 hours, 25/day for a week, then about 600/day, and newsletters wait 7 days. To protect their sending reputation.
- Users must verify their email (10-minute magic link) before sending any email.
- Access changes only take effect at next login; sessions end after 20 idle minutes.
- Invite = one-time link, 7 days, 3 per hour.

## How they handle email
- One-click unsubscribe headers, bounce list with reasons (bounce, overquota, complaint, suppressed), "deliverability" scan, no reachable guardian check. Spam complaints are never auto-cleared.
- Newsletter pulls each family's own balance, expiring health forms, RSVPs and recent awards at send time.
- RSVP by email link, no login.

## Events
- Recurring events can be edited "this / this and following / all"; only changed fields copy across; a schedule change on "following" splits the series.
- Attendance is separate from RSVP: no-shows, walk-ins, came-anyway; phone full-screen check-in; bulk "mark all going as attended".
- Charges are never changed by attendance; the treasurer unchecks no-shows.
- Event activities (nights, hours, miles) are event totals; credit to Scouts is applied separately.

## Advancement
- Rank statuses: Completed / Pending (all done but previous rank missing) / In progress / Not started. Nothing locked.
- Quick Complete, Add Award, edit date, Remove (keeps sign-offs and ordered/received dates). Chronological rank-order warning.
- Eagle Palms: 26, 31, 36... merit badges and 3 months since Eagle or last palm; never automatic.
- Award reports: ordered/received dates, save-N-changes, Avery 5160 labels, PDF.
- Eagle tracker "Eligible" = badges only (they say so).

## Money
- Double-entry with Asset/Expense/Revenue/Liability/Member accounts. Type can't change. Retire instead of delete (their delete orphans history, a trap).
- Charge-for-event shows each attendee's account and balance, lets you change amounts per person (adults at a reduced rate), won't double-charge. Charge Members batches dues. Edits reopen the whole batch.
- Parents can only move credit between their own accounts and never overdraw; treasurers get a warning.
- Only the Treasurer moves money (separation of duties); admins can only view.

## What we now have that came from this
Built since: RSVP vs who came card on events, Avery 5160 award labels, email bounce/complaint webhook that stops mailing dead addresses plus a "emails not going through" section on the reach report, expiring-form filters, tetanus/swim check, message groups.

## Still worth considering
- Eagle Palms eligibility (needs palm items in our catalog).
- Pending-rank status and a rank-date order warning on our advancement page.
- Event series editing options (this / following / all) if our recurring editor lacks them.
- Email verification + new-unit sending caps once Resend is live.
- Who-is-reachable scan as a monthly leader nudge.

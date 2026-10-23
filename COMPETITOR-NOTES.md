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

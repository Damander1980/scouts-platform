# BUGS

Code defects to fix. Ordered by blast radius (data loss / money first).

---

## FIXED and LIVE: migration 0034 pushed 2026-10-19 (commit ea6f3b7)

Migration history for 0001-0033 had never been recorded (they were applied by hand);
repaired with `supabase migration repair --status applied` after confirming 0033 was live.

Root cause for most of these: "leader" meant ANY adult role, including Committee Member
(Troop 999 has ~50), so every committee member had full leader access.

1. **Every troop member could read every Scout's birthdate, email, phone and member ID.**
   Row security limited WHICH people you saw, not WHICH FIELDS, and 0021/0033 added
   contact columns to `persons`. Any parent, or any Scout 13+ with a login, could pull them
   through the API. Fix: column grants hide those four fields; they come only from
   `person_private()` (own family, or adults with "See private details" and current YPT),
   and every look outside your own family is written to the audit log.
2. **Any committee member could write health-form status directly**, skipping the
   designated-leader check and the audit trail (`forms: leaders manage` from 0001 was never
   dropped). Fix: policy dropped; writes only go through `mark_form()`.
3. **Anyone signed in could insert fake audit-log rows for any unit** (`audit: service insert`
   was `with check (true)`). Fix: you can only log your own actions in your own unit.
4. **Every committee member could see every family's balance** (ledger, `unit_balances`,
   `dues_status`). Fix: needs "See family accounts".
5. **Committee members could sign off rank requirements**; the spec limits that to the
   Scoutmaster, assistants and counselors. Fix: follows from the narrower `is_org_leader`.
6. **A family member could change `persons.user_id`** (which login a person belongs to) from
   the client. Fix: `user_id` is no longer client-updatable.
7. **Committee members sent full-content emails** as leaders. Fix: only real leaders and
   admins.

## FIXED and LIVE: migration 0035 pushed 2026-10-19

8. **Roster import silently dropped Scoutbook Member IDs.** The database side accepted
   them (0033) but the import screen never sent the column. Fixed, and the importer now
   also reads YPT expiration dates. Re-importing a roster refreshes YPT for people already
   on it (never moves a date backwards) and fills in missing member IDs.

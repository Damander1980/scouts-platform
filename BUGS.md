# BUGS

Code defects to fix. Ordered by blast radius (data loss / money first).

---

## Fixed in code, waiting on migration 0034 to be pushed (2026-10-19)

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

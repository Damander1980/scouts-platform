# Troop Platform: MVP Spec

Oct 16, 2026 · @Floyd Kobler

## Vision and wedge

The MVP is a multi-troop platform where any family can create an account, add their kids, join a troop, and sign up and pay for an event in one flow, on web and as an installable app.

From the screenshots and descriptions of TroopWebHost (not hands-on use), the gaps are: dense admin-style screens, a clunky mobile experience, sign-up and payment as separate steps, and hard-to-undo attendance. Our wedge is parent-first design.

- **One account per person, many troops.** A parent with a Scout in Troop 999 and a younger sibling in a Pack uses one login.
- **Sign up and pay in one tap.** A text link opens an RSVP page: pick who is going, answer notes, sign the permission slip, pay.
- **Leaders see a live roster.** Who is in, who owes money, who is missing a form, who is driving.
- **Treasurer-friendly.** Fees post to a family ledger automatically; cancellations create credits by the rule shown at sign-up.

## Design principles

The product wins if a busy parent and a volunteer leader can do their jobs without training. These rules apply to every screen, and I'd test them with real troop families before each release.

- **Start from "what do I need to do?"** The home screen shows the next event, an RSVP button, and any balance due or form missing, not a menu of features.
- **Phone first.** Design for a thumb on a phone, then scale up. Text at least 16px, strong contrast, and large tap targets.
- **No password required.** Text and email links open the right page directly; sign-in uses magic link, Google or Apple.
- **Menus by task, not feature.** A parent sees Events, Pay, Forms and Family; Venturing or Sea Scout options appear only for units that use them.
- **Plain language.** "You owe $45 for Caprock Canyons" instead of ledger terms; every refund rule is stated at sign-up.
- **Undo is easy.** Cancelling an RSVP, correcting attendance, or reversing a charge takes one step and is recorded in the history.
- **Role-shaped views.** Parents, Scouts, leaders and treasurers each get a simple default screen with only what their role does.
- **Works at the campsite.** Core leader tasks work offline and sync later.
- **Short setup.** A troop admin can create the troop, invite families and post a first event in under 15 minutes without support.

Targets for the pilot: a parent completes RSVP and payment in under 60 seconds from the text link, with no help; a leader takes attendance for 30 Scouts in under 2 minutes; the treasurer needs no spreadsheet to reconcile an event. These are my proposed numbers; adjust them to what the pilot troop considers good.

## Pilot: Troop 999 Plano

Troop 999 of Plano, Texas, is the pilot troop and first customer. Every phase gate in the roadmap is tested with this troop before the next phase starts, and its current TroopWebHost site is the baseline we have to beat.

- **Phase 1 test.** The troop's next real campout is signed up through the new app, and the troop's page goes live at its own address on our site, our-domain/Troop999Plano.
- **Moving over.** The troop's admins export their own data (roster, events, forms, photos, balances) from their current account, and we import it through the CSV tools. We never scrape or log in to their existing account.
- **Running both.** The troop keeps its current site until each phase gate is passed, so no family is left without a working sign-up.
- **Feedback.** A short check-in after each real event with the Scoutmaster, treasurer and two parents, tracked against the design targets above.

Open questions about the troop, to answer before phase 1: how many Scouts and families it has, who its current TroopWebHost admins and treasurer are, whether the committee and chartered organization have approved the pilot, and which of its current features it uses most.

## Research: how Scouting units work and how we beat the tools

Scouting America's free Scoutbook Plus stays the official record for advancement, so our job is to be the better everyday tool around it, and never to ask troops to enter the same data twice.

| Tool | What it is | Gap we can fill |
| --- | --- | --- |
| [Scoutbook / Scoutbook Plus](https://shacbsa.org/scoutbook) | Scouting America's free, optional tool for advancement, messaging, calendar and activity logs | Leaders on [forums](https://www.scouter.com/topic/29648-t/) call it weak on communication, calendar, finances and roster; some council shops require its reports to buy [awards](https://www.glaciersedge.org/unit-resources/) |
| TroopTrack | Established multi-program troop manager | Scouting America [restricted its direct access](https://community.trooptrack.com/t/wheres-turbonet/9465/7) in 2019, so syncing is by file upload and download |
| [TroopWebHost](https://www.troopwebhost.org/help.aspx?ID=558&D=P) | Website-first unit manager | Imports Scoutbook Plus exports (roster, advancement, activity log) but does not sync; dense interface; forum posters say it is the only one with [linked-troop support](https://scouter.com/topic/33406-troopmaster-or-troopwebhost) |
| [Troop Campfire](https://scoutsmarts.com/troop-campfire-review/) | Newer tool built by a troop committee chairman, with messaging, a public site tied to the calendar, and role-based permissions | Newer and smaller, so it has fewer years of proof with treasurers and advancement |
| Spreadsheets, Google accounts, Facebook | What small units use when tools fall short, for finances, [communication](https://www.scouter.com/topic/17636-pack-management-software/) and sign-ups | Manual, hard to hand over when a volunteer leaves |

Four findings change the design:

1. **Do not try to replace Scoutbook Plus.** Scoutbook has no public API. Two [forum posts from October 2026](https://discussions.scouting.org/t/backend-access-to-scoutbook/512243) say only the web site and its quick export are available, a [2024 thread](https://discussions.scouting.org/t/scoutbook-api-key/412550) relays that Scouting America does not intend to release one, and a [read-only API was postponed indefinitely](https://discussions.scouting.org/t/read-only-api/239364) in 2021. None of these are labeled as official statements, so confirm with a council. We build upload-ready advancement exports and importers for its roster, advancement and activity-log files, and offer no live sync.
2. **Do not store the medical form.** Council pages say completed Annual Health and Medical Records [should not be scanned, emailed or stored electronically](https://nycscouting.org/medicalreview22/) by unit leaders. We track status and expiry instead, which is also the data leaders need. Confirm this with the pilot troop and council, since the pages date from 2020 to 2022.
3. **Our messaging rule matches official guidance.** Scouting America says two-deep leadership and no one-on-one contact apply to [digital communication](https://blog.scoutingmagazine.org/2016/06/15/youth-protection-and-texting-with-scouts), with a parent and another leader copied, and its [social media guidelines](https://scoutingwire.org/social-media-guidelines/) say adult-youth messages should be public or copy authorized adults.
4. **Two registered adults aged 21 or over** are required at all Scouting activities, so the trip ratio check should test exactly that, plus current Youth Protection Training.

**Ways to make it better**

| Idea | Problem it solves |
| --- | --- |
| Scoutbook-ready exports and importers | Advancement is entered twice; award purchases need Scoutbook reports |
| Form-status tracker that knows an event over 72 hours needs Part C, and that a record expires at the end of the 12th month after the exam | Leaders chase forms by hand and discover expiries at check-in |
| Eligibility filters combining advancement, training, swim classification and form status | A forum poster could not [build one report](https://scouter.com/topic/33406-troopmaster-or-troopwebhost) across advancement, training and swim checks |
| Linked troops for boy and girl troops and joint pack events, with a shared calendar and site | Only one competitor supports it, per forum posters |
| Youth-led planning: patrol leaders plan meals and duty rosters, a troop leadership meeting agenda and notes, elections, and leadership positions tracked for rank | Tools are built for adult admins; this is my assumption from how Scouts BSA works, so test it with the pilot troop |
| Weekly digest plus reminders only to families who have not responded | Parents miss messages sent to stale lists; leaders cannot plan without knowing who is coming |
| "Ways to help" board for parent volunteers, drivers and committee roles | Troops struggle to recruit parents to help |
| QR check-in for meetings and events | Slow paper attendance, feeding the activity credit tallies |
| Calendar feed to Google and Apple calendars | Families keep their own calendars and miss changes |
| Driver checklist for trips (license and insurance confirmed once a year) | Councils verify drivers, which can take time per a forum post, so confirm current rules |
| Court of Honor planner with an awards purchase list | Awards are bought from reports; the list saves a second spreadsheet |
| One-click export of all troop data | Switching cost and data-ownership worries; we say so on the pricing page |

Many of these sources are forum posts or older pages, so treat the findings as leads to confirm with Troop 999's leaders and with Scouting America before building.

## Accounts and tenancy

A login belongs to a person, not a troop. Troops and families are separate groupings that people join, so one person can belong to several of each.

| Concept | What it is | Example |
| --- | --- | --- |
| User | Someone who logs in (email, phone, or Google/Apple) | A parent, a leader, or a Scout aged 13+ |
| Person | A human in the system; may or may not have a login | A 9-year-old with no login |
| Household | A family group that shares a ledger and contacts | The Garcia family |
| Organization | A troop, pack, crew or ship; the tenant with its own settings, site and money | Troop 999 |
| Membership | Links a person to an organization with a role and status | Maya Garcia, Scout, Active |

**Join a troop.** A troop admin shares an invite link or code (or the troop is found by search). The family submits a join request for specific people; a leader approves; each person gets a membership.

**Join or form a family.** The first adult creates a household and adds children as people without logins. Another adult (spouse, guardian) joins by invite code and is confirmed by an existing adult. A divorced-parent case is supported by allowing one child in two households with separate billing.

**Kid logins.** Scouts 13 and older can have their own login, created and linked by a parent, and see only their own schedule, advancement and sign-ups. Under 13, children are managed entirely by a parent (see COPPA in Risks).

**Isolation.** Every record carries an organization id and is filtered by it in the database (row-level security), so one troop can never read another's data. A family's household data is visible to a troop only for the people enrolled there.

## Roles and permissions

Roles are per organization, so the same person can be a parent in one troop and a leader in another. Youth data is minimal by default.

| Capability | Parent | Scout 13+ | Leader | Treasurer | Troop admin |
| --- | --- | --- | --- | --- | --- |
| See own household's events, balance, forms | Yes | Own only | Yes | Yes | Yes |
| RSVP and pay for own family | Yes | RSVP only | Yes | Yes | Yes |
| See full troop roster (names, patrols, ranks) | Yes | Yes | Yes | Yes | Yes |
| Create and edit events | No | No | Yes | No | Yes |
| View all family ledgers, issue credits, refunds | No | No | No | Yes | Yes |
| Approve join requests, change roles | No | No | No | No | Yes |
| Export rosters and form status | No | No | Yes | No | Yes |

Two-deep leadership rule: any adult-to-youth messaging goes to a parent or is visible to a second adult. Medical form status and permission data are visible only to leaders on that event's roster, and access is logged.

**Roster visibility.** Everyone in a troop (Scouts with logins, parents, leaders, treasurer and admins) can see the full roster: names, patrols, ranks and positions. Contact details work differently. A family's phone number and email are shown to other troop members only if that family opts in, and a Scout's own phone or email is shown only to leaders. This keeps the roster useful for carpools and planning while keeping adults from contacting a Scout directly outside the platform, in line with the no one-on-one rule. Families can change their choice at any time, and troop admins set the default for adults (I recommend opt-in). Payment and form status are never part of the member roster; only leaders and the treasurer see those.

Advancement sign-off is limited to the Scoutmaster, assistant Scoutmasters and approved merit badge counselors; parents cannot sign off, and Scouts can only request. Counselor is a role on a membership, not a separate account type.

## User management

Troop admins run their own troop without contacting us. One Members page covers everything:

- **Invite and approve.** Invite people by email, text or code, and approve or decline join requests from families.
- **Roles and positions.** Assign roles (parent, Scout, leader, counselor, treasurer, admin) and troop positions such as Scoutmaster, Senior Patrol Leader and patrol leader; assign Scouts to patrols and move them between patrols.
- **Lifecycle.** Deactivate or archive members who leave, prompt when a Scout turns 18 to convert them to an adult or alumni, and merge duplicate records.
- **Bulk tools.** CSV import and export of the roster.
- **Safeguards.** A troop must keep at least two admins, the last admin cannot be removed, and every role change is logged with who made it and when.
- **Our access.** Our staff can see a troop's data only when a troop admin grants it for a support request.

User management ships in phase 1, since nothing else works without it.

## Patrols and youth leadership

In a Scouts BSA troop, Scouts are grouped into patrols, so patrols are a first-class part of the product and not a tag on a roster. Patrol sizes and structure vary by troop, so everything below is configurable.

- **Patrol setup.** A troop admin creates patrols with a name, a patrol leader and an assistant patrol leader, and assigns Scouts. Moves between patrols keep their history with dates. A new-Scout patrol and a troop guide or adult advisor can be assigned too.
- **Patrol view.** Each patrol has its own page: members, upcoming events, who has RSVPed, and a patrol-level to-do list.
- **On trips.** Patrols plan their own meals, grocery lists and duty rosters inside the trip plan, and the roster groups sign-ups by patrol so patrols camp and cook together.
- **Patrol communication.** Patrol leaders can message their patrol through the platform, and every message is logged and copied to the designated leaders under the same rules as all youth communication.
- **Patrol Leaders' Council.** The senior patrol leader, patrol leaders and troop leaders get a council space: meeting agenda, notes, action items, and quick polls. The council plans the program; adults review it.
- **Positions of responsibility.** Elected and appointed youth positions are recorded with start and end dates so leadership time counts toward rank requirements automatically, subject to the current requirements.
- **Patrol filters everywhere.** Rosters, attendance, advancement reports, messaging and event sign-up can be filtered or grouped by patrol.
- **Permissions.** Patrol leaders see their own patrol's RSVPs and meal plans, not other families' contact details, payments or medical form status, and cannot approve advancement.

The data model adds patrols and patrol\_members (person, patrol, role, start and end dates), plus leadership\_positions for troop-level youth roles.

## Import and export

Troops move data in and out of the platform by file, in both directions, and there is no live connection to Scoutbook or any other system.

- **Import.** Scoutbook's three export files (roster, Scout advancement, activity log) and CSV files for rosters, balances and events. A preview shows what will be added or changed before anything is saved, and an import can be undone.
- **Export.** Scoutbook-ready advancement and activity files for upload, plus CSV of rosters, attendance, the ledger and budgets, and PDF rosters and tour permits for printing.
- **Everything, any time.** One click downloads all of a troop's data, so a troop never feels locked in.
- **Safety.** Files are checked before import, imports are logged with who ran them, and exports of youth data are limited to troop admins and designated leaders.

## Gaps other tools already fill

Everything on TroopWebHost's feature list is covered in the sections above. These are the extra items I found in other tools and in leaders' complaints, now added:

- **Recharter helper.** A yearly checklist of registrations, training and fees, with a roster export ready for renewal.
- **Linked troops.** A boys' and a girls' troop, or a troop and a pack, share a calendar, events and site with separate rosters and combined sign-ups.
- **Program templates.** Scouts BSA (patrols), Cub Scouts (dens), Venturing, Sea Scouts, Trail Life USA, American Heritage Girls and other groups, each setting unit names, groups and the rank and award catalogs. Scouts BSA ships first.
- **Eagle project tracker and Court of Honor planner,** including the awards purchase list.
- **Product fundraising.** Campaign setup, Scout order entry, personal links, and CSV import of council sales reports for programs such as popcorn.
- **Calendar feed, weekly digest and QR check-in,** so families see changes in their own calendars and leaders take attendance faster.
- **Adult skills and interests inventory,** so leaders can see which parents can help with what.

## Advancement and merit badges

**Ranking system.** The troop's Scouts advance through Scout, Tenderfoot, Second Class, First Class, Star, Life and Eagle.

- Each rank has a requirement checklist in a catalog we maintain. Requirements are versioned by effective date; confirm with Scouting America's current guidance which version applies to a given Scout.
- A Scout marks a requirement ready or requests a sign-off; a leader approves it with their name and date.
- When all requirements are done, the app schedules the Scoutmaster conference and board of review, records the results, and sets the date the rank is awarded.
- Time-based requirements, such as months in a leadership position, are tracked by dates.
- Parents see progress read-only; Scouts can request but cannot approve.
- Leaders get reports: who is close to the next rank, progress by patrol, and Eagle tracking (required badges, leadership, service project).

**Merit badge progress tracking.** Each Scout has a page showing badges in progress, partials, and completed badges with dates, plus a progress bar for each badge's requirements.

**Merit badge management.**

- A catalog of current badges with requirement checklists, with Eagle-required badges marked.
- A Scout requests a badge, the Scoutmaster approves it and assigns a counselor from the troop's approved list (the digital version of the blue card), and the counselor signs requirements as the Scout completes them.
- Counselors have a dashboard of their assigned Scouts, the badges they can counsel, and their training status.
- Counselor meetings show a reminder of the buddy and two-deep rules.
- Reports: badges earned by Scout and by badge, and a purchase list for patches and awards.
- Sync or export to Scoutbook, if Scouting America allows it.

**Skill cards and certifications.** Totin' Chip and similar skill cards are tracked in the same progress area as merit badges, as their own kind of item with their own catalog entries.

- Each certification has its own catalog entry (for example Totin' Chip for woods tools; troops can add others such as fire safety or other troop-specific awards), with the date earned and the leader who signed.
- A Scout's merit badge progress page shows badges and certifications together (in progress, partials, completed), using the same request and sign-off flow.
- Leaders can see on an event roster who holds which certification, so they know who may use which tools on a campout.
- A leader can record that a certification was suspended or taken back, with a date and a note, and restore it later; every change is logged.
- Reports and a purchase list cover the cards and awards the troop needs to order.

The data model adds certifications and scout\_certifications (earned date, signed by, status, history).

## Communication with minors

The rule is that no adult communicates with a minor in private, and all of it is on the record.

- **Everything is logged.** Every message to or from a minor, on any channel the platform sends (email, text, in-app, forum posts and replies), is stored with sender, recipients, time and content. Senders cannot edit or delete these messages.
- **Leaders always receive a copy.** Each message to a minor is also delivered to the troop's designated leaders, set by the troop admin (at least two adults).
- **Parents.** Scouting America's guidance says leaders should copy a parent and another leader on digital messages to youth, so every message to a Scout is always copied to the Scout's parents or guardians as well as the designated leaders (confirmed by Floyd).
- **Under-13 Scouts** are messaged only through their parents; they have no logins.
- **No private one-on-one threads** between an adult and a Scout. A Scout's reply goes to the same group.
- **Contact details stay hidden.** Scouts' phone numbers and personal email addresses are visible only to leaders, and messages go through the platform so adults do not need to use their own accounts.
- **Access to logs** is limited to troop admins and designated leaders, and each view is itself recorded.
- **Retention.** Logs are kept until a parent or guardian requests deletion, as described under Trust and data protection.

## Trust and data protection

All in-app communication is encrypted, saved and tamper-proof, and only a parent or guardian can ask for it to be deleted.

- **Saved by default.** Messages, replies, forum posts and comments go into an append-only log. Nobody can edit or delete a message, including troop admins, leaders, Scouts and our own staff.
- **Messages live in the app.** Email, text and push only say that a message is waiting, with a link and no message content. Reading it requires signing in.
- **Protection.** Data is encrypted in transit and at rest. Sign-in is by magic link, Google or Apple, and admins, leaders and treasurers must also use two-step verification. Sessions time out, and every view of the message log is recorded.
- **Backups and incidents.** Encrypted daily backups with restore tests, and a written incident plan that tells troops and parents quickly if something goes wrong.
- **Collect less.** We do not store medical forms (status only), government ID numbers or card numbers; Stripe holds payment data.
- **Who can request deletion.** Only a verified parent or guardian, for their child's data and their own. Leaders, admins, Scouts and our staff cannot.
- **How a deletion works.** The parent submits the request from their signed-in account and confirms by emailed link. Designated leaders are told it was made. After a waiting period (I propose 14 days) the child's messages, profile and photos are deleted. We keep only a record with no content showing that a request was made and carried out.
- **Pause for safety.** If a safety report is open or the law requires keeping the records, deletion pauses and the parent is told why.
- **Open issue for a lawyer.** Messages are both personal data and youth-protection records, so deleting them could hide a problem. COPPA also lets parents of children under 13 have their child's information deleted. A lawyer should confirm the waiting period, the pause rules and the kept record before wider launch.
- **Privacy promise.** No ads, no selling data, and a plain-language privacy page.
- **Before others use it.** For the Troop 999 test, only invited users, and a security review before any other troop joins.

## Notifications and text messaging

Every person controls how and when the app contacts them.

- **Settings per person.** Channels (email, text, push, in-app) and categories (event reminders, RSVP deadlines, payments and balances, messages from leaders, weekly digest, urgent changes), with quiet hours (default 9 PM to 8 AM local time, adjustable) and a choice of digest day.
- **Defaults.** Email on, push on after install, text off until the person opts in.
- **Text opt-in is recorded.** A checkbox that is not pre-ticked, with the exact wording shown, the phone number, date and time, and how they agreed. A confirmation text follows.
- **Unsubscribe is always easy.** STOP and HELP replies are handled automatically, email has an unsubscribe link, and notification settings are one tap away. An opt-out takes effect immediately and is logged.
- **Carrier registration.** US carriers block texts from unregistered numbers, so we register the sending number through our text provider (ten-digit local number registration or toll-free verification) before sending. This can take days to weeks, so it starts in phase 1. Confirm current requirements with the provider.
- **Content.** Short organizational messages with a link; no marketing and nothing sensitive in the text itself.
- **Adults only.** In this version texts go only to parents and adult leaders, never to a Scout's own phone.
- **Limits.** Families see how many messages they got this week, and leaders see a warning before a broadcast that would exceed a weekly cap.
- **Urgent changes.** A weather cancellation may go out during quiet hours, but only to people who opted in to text, and never against an opt-out.
- **Delivery log.** Each notification is recorded with its status (sent, delivered, failed).

## Finance and budget planning

Troops get a budget they can plan, approve and track within the same Stripe-based ledger.

- **Annual budget.** Define the fiscal year, set income lines (dues, fundraising, donations) and expense lines (camping, equipment, advancement awards, training), and record the committee's approval.
- **Event and trip budgets** come from the trip cost calculator and roll up into the annual budget.
- **Budget versus actual** updates live from the ledger, with an alert when a line passes a threshold (I propose 80%, adjustable).
- **Spending controls.** Purchases above a limit set by the troop need a second approver, with a full audit trail.
- **Reports.** Monthly treasurer report, year-end report, and CSV or PDF exports for the troop committee and chartered organization.
- **Who sees what.** The treasurer edits, the committee chair approves, leaders see summaries, and parents see only their own family's account.

## QR code donations

A troop can accept donations from anyone who scans a code on a flyer, a booth sign or a phone screen.

- **Campaigns.** A treasurer or admin creates a donation campaign with a name, an optional goal, and a destination: the general troop fund, a trip, equipment, or a Scout's fundraiser.
- **Donation page.** Each campaign gets a page and a QR code. Donors choose an amount, pay with Apple Pay, Google Pay or a card through Stripe, and need no account. The page always shows the troop's name and our address so donors know where they are.
- **Print and display.** One click makes a PDF flyer, table tent and sticker sheet with the troop's logo and QR code, and a booth mode shows a large code on a phone or tablet.
- **Scout codes.** Each Scout can have a personal code or link so gifts credit their Scout account, subject to the chartered organization's rules, which the troop should confirm.
- **Tracking.** Totals by campaign, by Scout and by source, using separate codes for flyer, booth and email, plus scans against gifts.
- **Fees.** The Stripe fee is shown to the treasurer, and donors can choose to cover it.
- **Receipts.** Donors get an emailed receipt and thank-you. We do not claim a gift is tax-deductible by default, since a troop may not be tax-exempt itself; the receipt wording is set by the troop and checked with its chartered organization or an accountant.
- **Donor privacy.** Only name and email are collected and they are visible only to the treasurer and admins.

## Fundraising goals

A page where the troop sets what it is raising money for and everyone can watch the progress.

- **Goals.** Admins and the treasurer create goals such as new tents, summer camp scholarships or a high adventure trip: target amount, deadline, description and photo.
- **Progress.** A progress bar shows the total raised toward each goal, fed by Stripe payments, donations (including QR code gifts) and fundraiser sales recorded in the ledger.
- **Everyone sees it.** Scouts, parents and leaders see all goals and totals. Each Scout sees their own fundraiser earnings, which can be applied to their event costs. Whether individual Scout totals appear on a troop leaderboard is a troop setting, off by default.
- **Public goal card.** A goal can be shown on the troop's public page with a donate button and QR code.
- **Fundraisers.** Each fundraiser (popcorn, wreaths, car wash) is tied to a goal, with a sales target, dates and how earnings are split between the troop and each Scout's account.
- **Link to the budget.** Goals feed the income lines of the annual budget, and spending on a goal is tracked against it.

## Troop website builder

Every troop gets its own public website that its admins build and edit without a developer. It also serves as the front door for new families, who can find the troop and request to join.

- **Branding.** Upload the troop logo and a banner image, pick colors and a font pair from tested combinations that keep text readable.
- **Pages and sections.** Start from a template with Home, About the troop, Photos, Calendar, Leaders and Contact pages; admins add, reorder, rename or remove pages. Each page is built from simple blocks: heading, text, image, photo gallery, video link, button, map, event list, contact form, and file download.
- **About the troop.** Story and history, chartered organization, meeting day, time and place with a map, what Scouts do, and costs.
- **Photos.** Albums and galleries with captions, uploaded from a phone or computer, automatically resized for fast loading.
- **Public or members-only.** Each page and album is marked public (anyone) or members-only (signed-in troop members). Pages start as drafts and go live only when an admin publishes them; there is a preview for phone and desktop.
- **Live content.** Blocks can show the troop's public upcoming events, next meeting, and a "join us" button that opens the join request flow.
- **Custom domain included.** Every troop gets a free address on our site built from its troop number and city, for example our-domain/Troop999Plano for Troop 999 in Plano, Texas, served over HTTPS. Families always come to our site. A troop's own domain name could be connected later as an option.
- **Editing roles.** Troop admins and anyone they give the "web editor" role, such as a parent volunteer, can edit; changes keep a history so a page can be rolled back.

Youth privacy rules for public pages:

- A photo of a Scout can be set public only if the troop has recorded a parent's photo consent for that Scout; unrecorded photos stay members-only.
- Public captions use first names only and never show a Scout's address, school, phone number or email.
- The public Leaders page shows only adults who agreed to be listed, with a contact form instead of personal emails.
- Admins can pull a photo down at any time, and a parent can ask for removal.

A basic starter page (logo, about text, meeting details, join button) is built in phase 1, because the join link needs somewhere to land; the full builder is phase 4.

## Core MVP features

The MVP is five things; everything else waits.

1. **Sign-in and onboarding.** Email magic link, Google and Apple sign-in; create household, add kids, join a troop by code.
2. **Events and RSVP.** Calendar and agenda list; events with dates, location, cost, caps, waitlist and deadlines; multi-day events shown as one bar; per-person yes/no, drivers and seats, dietary notes.
3. **Payments and family ledger.** Stripe checkout with card, Apple Pay and Google Pay; a balance per household; fees post at sign-up; credits on cancellation by the event's refund rule; treasurer view of who owes what.
4. **Forms.** Digital permission slips signed once per year and attached to each event roster. For the Annual Health and Medical Record we track only whether each person has Parts A, B and C on file and when each expires; the form itself stays with the troop's designated leader, because council guidance says completed forms should not be scanned or stored electronically.
5. **Roster and messaging.** Leader roster with in, missing form, owes money, driving; email and push to a whole troop, a patrol, or only families who have not responded.

**Required before charging troops.** From the TroopWebHost feature list (unverified, see Risks), troops will expect these before they switch. They are built after the five above:

- **Advancement.** Rank checklists (Scout through Eagle), merit badges and awards; Scouts request sign-offs and leaders or approved counselors approve on web or app; progress reports; export or sync to Scoutbook if Scouting America's data rules allow.
- **Compliance tracking.** BSA registration status, medical form expiry, Youth Protection Training and other leader training, swim classification and uniform sizes, with expiry alerts and a "ready to go" check on each event roster.
- **Attendance and activity credit.** Take attendance at events and auto-tally camping nights, service hours, and hiking, cycling and paddling miles; undoing an attendance mark is one tap.
- **Offline mode.** The installed web app caches the roster, forms and requirements so attendance and sign-offs work at a campsite and sync later. Offline support in a web app is more limited than in a native app, especially on iPhones, so test it on real devices before promising it to troops.
- **Volunteer shifts.** Time-slot sign-ups for booths and fundraisers.
- **Fundraising.** Campaigns with products and prices, Scout order entry, personal links for family and friends, booth schedules, consolidated purchase lists, and proceeds credited to individual Scout accounts.
- **Scout accounts and unit ledger.** Individual Scout balances (fundraiser earnings applied to camp fees and dues), the troop's own income and expense ledger by event, and expense reimbursement requests with photo receipts.
- **Equipment and library.** Check-out and return of troop gear (tents, stoves, trailers) and books, with who has what.
- **Communication extras.** Email and SMS to a patrol, the Patrol Leaders' Council, or other custom groups; discussion forums; surveys and voting with tallies.
- **Documents and public site.** A file cabinet with public and members-only files, plus a simple public troop page (meeting times, contacts, join link) to attract new families.
- **Import.** CSV import of rosters and balances so troops can move over from spreadsheets or other systems.

**Deliberately later:** payment plans and direct migration tools for TroopWebHost and Scoutbook data.

## Money management on Stripe

Online payments go through Stripe, so most of the ledger is built from Stripe records and not typed in by hand. Cash and checks are always allowed: a troop can run on cash alone and turn on card payments later.

- **Troop account.** Each troop onboards as a Stripe connected account with its own bank account. Funds settle to the troop, and we never hold them.
- **Ways to pay.** Card, Apple Pay and Google Pay, and bank transfer (ACH), which usually costs less than cards; check current Stripe rates before setting any fee policy.
- **Dues, event fees and fundraiser orders** are Stripe charges that post to the right household and event automatically through webhooks.
- **Refunds and credits** follow each event's refund rule and are issued from the app, either back to the card or as credit on the family balance.
- **Booth sales.** Stripe's card readers (Terminal) take in-person payments at popcorn or concession booths and credit the selling Scout's account.
- **Cash and checks are always allowed** (Floyd). The treasurer records them against a household with no fee; they appear in the same ledger, marked as manual.
- **Reimbursements.** Leaders submit a receipt photo, the treasurer approves, and the payout is sent through Stripe. Paying individuals this way has account-setup requirements, so confirm the options with Stripe before building it.
- **Treasurer reports.** Balance by family, income and expenses by event, budget versus actual, and a year-end export, all from the same ledger.

Open questions to settle with Stripe and a professional: how a troop's tax ID and nonprofit status are handled at onboarding, who is responsible for disputes and chargebacks, and how Scout individual accounts are treated under the troop's chartered organization rules.

## Trip planning and easy sign-up

A trip is an event with a plan attached, so the plan, the sign-up and the money live in one place.

- **Trip plan.** Dates, destination with map and driving directions, an itinerary by day, and the permits or tour plan checklist.
- **Cost calculator.** Enter expected costs (campsite, food, transport, gear); the plan gives a cost per Scout and sets the event fee, then compares budget with actual after the trip.
- **Meal planning.** Menus by patrol, with grocery lists that scale to the number of people signed up.
- **Packing lists.** Reusable templates (weekend campout, summer camp, backpacking) that each family sees on the sign-up page.
- **Transportation.** Drivers offer seats during sign-up and leaders see unmatched riders; vehicle and insurance details are collected once per driver.
- **Adult ratios.** A live check that the trip has enough registered, trained adults and two-deep leadership before it is confirmed.
- **Task assignments.** Leaders assign roles and to-dos (permits, food purchase, gear pickup) with due dates and reminders.
- **After the trip.** Attendance is confirmed and nights camped, service hours and miles are credited to each Scout automatically.

**Sign-up has to feel effortless.** The experience for a family:

1. Tap the link in a text or email; no password.
2. See the trip summary, cost and deadline at the top.
3. Tick who is going (kids and adults are pre-listed from the household and remembered from the last trip).
4. Answer only the questions that apply, with earlier answers prefilled, and sign any needed permission slip once.
5. Pay with Apple Pay, Google Pay or a saved card, and see a confirmation with the trip plan and packing list.

Changing plans is as easy: the same link lets a parent drop a Scout or switch drivers, and shows exactly what credit they will receive.

## Who is going: attendance for everyone

Every event page shows three lists to everyone in the troop (Scouts, parents, leaders): **Going**, **Not going**, and **Hasn't responded**. Each shows names, patrol and a status chip only. Why someone is not going, payment amounts and form status are not shown to other families; only leaders and the treasurer see those. Leaders and patrol leaders can nudge the "hasn't responded" list in one tap, and that message is logged and copied to leaders like every other message.

## Scouts do it themselves

Scouting teaches self-responsibility, so a Scout with a login (13+) can do most things on their own. Parents stay in the loop and keep the final say on money and consent.

- **Scouts can:** RSVP for themselves, pick up and update their own rank and merit badge progress, request sign-offs, keep their own calendar, message their patrol and leaders (always logged and copied), plan meals and gear for their patrol, and, as a patrol leader or senior patrol leader, run their patrol's sign-ups, duty rosters and outings.
- **Parents keep:** paying with the family card (a Scout can pay from their own earnings credit), signing permission slips, health forms, deleting messages, and changing contact choices.
- **Troop setting:** admins choose whether a Scout's RSVP is final or needs a parent's approval for paid events. Default: the Scout RSVPs and the parent approves any payment.

## Health and medical forms

The troop keeps a library of the blank forms (Annual Health and Medical Record Parts A, B and C, permission slips, tour plan). **Everyone in the troop can download them. No one uploads completed forms.** This matches council guidance that completed medical forms should not be scanned, emailed or stored electronically. A leader marks each person's parts as **received** and enters the expiry date. Families and leaders then see only a status (on file, expires soon, needed), and the event roster's "Form needed" chip comes from that status. Only designated leaders can mark a form received, and each change is recorded in the audit log. Leaders can see a printable list of who is missing which part for any trip, and we can offer a download that leaders keep on paper during the trip.

## Data model

Ten core tables cover the MVP. Every table except users and persons also carries organization\_id.

| Table | Key fields | Relates to |
| --- | --- | --- |
| users | id, email, phone, auth provider | One person (optional) |
| persons | id, name, birthdate, type (adult, youth) | Households, memberships |
| households | id, name, billing contact | Persons through household\_members |
| household\_members | household\_id, person\_id, relation, is\_guardian | households, persons |
| organizations | id, name, type, join code, settings | Everything below |
| memberships | org\_id, person\_id, role, status, joined\_at | organizations, persons |
| events | org\_id, title, start, end, location, cost, cap, deadline, refund\_rule | rsvps, ledger\_entries |
| rsvps | event\_id, person\_id, status, driver\_seats, notes | events, persons |
| ledger\_entries | org\_id, household\_id, amount, type (charge, payment, credit), event\_id, stripe\_id | households, events |
| forms | org\_id, person\_id, type, signed\_by, signed\_at, expires\_at | persons |

The ledger is append-only: a cancellation adds a credit entry rather than editing a charge, which gives the audit trail a treasurer needs.

The parity features add these tables, each also carrying organization\_id: requirements and requirement\_progress (advancement), signoffs, compliance\_records (medical form, training, swim, registration, with expiry), attendance and activity\_credits, shifts and shift\_signups, fundraisers, products and orders, equipment and checkouts, documents (with a public or members-only flag), expense\_requests, and messages, polls and votes.

Trip planning adds trip\_plans, itinerary\_items, packing\_templates and items, meals, trip\_budget\_lines, vehicle\_offers (seats and driver), and trip\_tasks. Stripe objects (customer, payment intent, refund, payout) are stored as ids on ledger\_entries so the ledger can always be reconciled with Stripe.

Management, advancement and safety features add: audit\_log (role changes and log views), message\_log (immutable), message\_recipients (including the copied leaders), merit\_badges, badge\_applications, badge\_counselors, rank\_awards (conference and board of review dates), budgets and budget\_lines.

The website builder adds site\_settings (logo, colors, domain), site\_pages, page\_blocks, albums, media\_assets (with a public or members-only flag and photo-consent link) and domains. Images are stored in object storage, and custom domains are connected through the hosting provider's domain service.

## Tech stack

Build one mobile-first web app that installs to the home screen (PWA) with no native app planned, so a parent can RSVP from a text link with nothing to download.

| Layer | Choice | Why |
| --- | --- | --- |
| Web app | Next.js (React, TypeScript) | One codebase for site, RSVP pages and admin |
| Database and auth | Postgres on Supabase | Row-level security enforces troop isolation; built-in magic link, Google, Apple |
| Payments | Stripe Connect | All money runs through Stripe: each troop has its own connected account, so funds go to the troop, not to us |
| Email and SMS | Resend and Twilio | RSVP links and reminders |
| Push | Web push through the installed web app | No app-store review or fees |
| Hosting | Vercel | Cheap at small scale |

Web first: there is no native app in this plan. If pilot troops later ask for one, the same Supabase backend and API can serve it.

## Pricing and business model

The market sets a price anchor of about $100 per unit per year, so we compete on ease of use, not on a lower price. At $125 with the custom domain included, we sit about $9 below TroopWebHost's $109 plus its $25 domain add-on ($134), using the unconfirmed figures above.

Troop Campfire, another competitor, lists $125 per year according to a [ScoutSmarts comparison](https://scoutsmarts.com/scout-troop-management-tool-comparison/) (a site that may earn affiliate income), the same as our price, so we need a clear reason to be chosen over it.

| Provider | Pricing | Source |
| --- | --- | --- |
| TroopWebHost | $109 per year flat per unit; about $25 per year for a custom domain; about $1 per GB per year over 10 GB (as pasted, not confirmed on its site; a 2014 forum post cites about $99-100 per year) | [Scouter forum](https://scouter.com/topic/26681-host-site-for-troop-management-website) |
| TroopTrack | $99 per year, $10 per month, or $27 per 3 months, with a 30-day free trial | [TroopTrack support](https://support.trooptrack.com/portal/en/kb/articles/creating) |

Proposed model, to test with the pilot troop:

- **Flat price per unit**, $125 per unit with a free custom address on our site included, billed through Stripe Billing on our own Stripe account, separate from each troop's connected account. The price is $125 per year per unit.
- **Free first year for the pilot troops** in exchange for feedback and a testimonial.
- **Include what competitors charge extra for:** custom domain and generous storage in the base price, which removes two common add-on fees.
- **No markup on payments.** Stripe's card processing fee (roughly 2.9% plus 30 cents per charge; check current rates) is shown at checkout, and each troop chooses whether families or the troop cover it.
- **No ads and no selling of data.** For a product holding children's information this is a selling point, so state it on the pricing page.

At $125 per year, 1,000 paying units would bring in about $125,000 per year before costs. The free address on our own domain adds no per-troop cost; connecting a troop's own domain name, if we offer it later, would add a small registration fee. The business depends on low support load and word of mouth between troops.

## Risks and roadmap

The biggest risks are trust and switching cost: troops hold volunteer money and children's data, and moving off an incumbent is painful.

- **Children's privacy.** Collecting data from children under 13 in the US falls under COPPA, which requires verifiable parental consent; keep under-13s as parent-managed records with no login. Confirm the details with a lawyer before launch.
- **Money handling.** Use Stripe Connect so we never hold troop funds; keep the ledger append-only with an audit trail. Check state rules on fees and refunds with a professional.
- **Switching cost.** Without import from TroopWebHost, Scoutbook or spreadsheets, troops will not move; CSV import comes right after the MVP.
- **Scouting affiliation.** Check the Scouting America trademark and data-use rules before using its name or marks in branding.
- **Cold start.** A platform with no troops has no families; recruit one pilot troop before building past the MVP.

| Phase | Scope | Gate to move on |
| --- | --- | --- |
| 1. Weeks 1-4 (Troop 999 test) | Sign-in, households, join-a-troop, user management, patrols, events and RSVP, secure in-app messaging with logging, notification settings with email, file import, starter page. Start SMS carrier registration now, since it takes time | Troop 999 signs up for a real campout and messages are logged correctly |
| 2. Weeks 5-8 | Stripe payments and family ledger, form status, leader roster, QR donations, text messaging once registered, parent deletion requests | Troop 999 collects real money with no treasurer workarounds |
| 3. Weeks 9-16 | Advancement, merit badges and skill cards, compliance tracking, attendance and credits, trip planning, budgets, Scoutbook-ready exports | Scoutmaster runs advancement and attendance only in the app |
| 4. Weeks 17-24 | Full website builder, fundraising and Scout accounts, reimbursements, shifts, gear, documents, surveys, recharter helper, linked troops, Eagle and Court of Honor tools, offline support in the web app | Three more troops onboard and pay |
| 5. After | Program templates beyond Scouts BSA (Cub Scouts, Venturing, Sea Scouts, Trail Life USA, American Heritage Girls), payment plans, migration tools | Paying customers asking for each |

The week estimates assume one full-time developer and are rough.

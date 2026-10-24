// Help center content. Every step must match the app as it is: update an article when its screen changes.
// Menu paths use the Leader tools sidebar groups (People, Calendar, Advancement, Safety, Money, Unit).

export type Block = { p: string } | { h: string } | { steps: string[] } | { list: string[] } | { tip: string } | { note: string };
export type Article = { slug: string; title: string; who: string; summary: string; body: Block[] };
export type Section = { slug: string; title: string; blurb: string; articles: Article[] };

export const SECTIONS: Section[] = [
  {
    slug: "getting-started", title: "Getting started", blurb: "Start your troop, bring in your roster, and get families signed in.",
    articles: [
      {
        slug: "start-your-troop", title: "Start your troop", who: "First admin",
        summary: "Create your account, start the troop, and become its first admin.",
        body: [
          { p: "Starting a troop makes two things at once: the troop, and your admin access to it. You get 30 days free; after that it's $125 a year for the whole troop." },
          { steps: [
            "Go to the sign-in page and choose Create an account (email and password, or Google).",
            "Start a troop: enter the troop number and city.",
            "Enter your Youth Protection Training (YPT) expiration date. Leaders without current YPT can't see private details about Scouts.",
            "Set up two-step sign-in the first time you open Leader tools (see Two-step sign-in).",
          ] },
          { tip: "Open Leader tools → Overview right away. Its checklist shows what's left to set up." },
          { h: "What next" },
          { list: ["Import your roster", "Add a second admin", "Invite families"] },
        ],
      },
      {
        slug: "import-roster", title: "Import your roster", who: "Admins",
        summary: "Bring Scouts and adults in from a Scoutbook or TroopWebHost export instead of typing them.",
        body: [
          { p: "Import saves hours on day one. You can also bring in advancement history from Scoutbook so ranks and badges are right from the start." },
          { steps: [
            "Go to Unit → Import & export.",
            "Upload your roster file. The preview shows what will be added before anything is saved.",
            "Check the matches, then import.",
            "To bring in advancement, upload the Scoutbook advancement file the same way.",
          ] },
          { note: "Rows with a date we can't read are skipped and listed, never dated today, so rank timing stays right." },
          { tip: "Imported families don't have logins yet. Give each family a claim code, or send the invite link (see Invite families)." },
        ],
      },
      {
        slug: "invite-families", title: "Invite families", who: "Admins",
        summary: "Share one link or code. Families sign up, add their Scouts and ask to join; you approve them.",
        body: [
          { steps: [
            "Go to People → Members and choose Invite families.",
            "Copy the invite link, copy the ready-made message, or use Email the invite to open it in your own email.",
            "Families create an account, add their Scouts and ask to join with the link or the join code.",
            "When Members shows families waiting, choose Review, then Approve or Decline.",
          ] },
          { h: "Family already on the roster?" },
          { p: "If you imported or added a family yourself, open the person on Members, choose Edit, then Make a claim code for this family. The parent enters it during sign-up and takes over the existing record instead of creating a duplicate." },
          { note: "Claim codes work once and expire after 14 days. After 10 wrong tries in an hour, the account has to wait." },
        ],
      },
      {
        slug: "two-step-sign-in", title: "Two-step sign-in", who: "Leaders, treasurers, admins",
        summary: "Leader tools show children's information, so they need a code from your phone as well as your password.",
        body: [
          { steps: [
            "The first time you open Leader tools, scan the QR code with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password and others work).",
            "Enter the 6-digit code to finish.",
            "After that, enter a fresh code once each time you sign in.",
          ] },
          { h: "New phone" },
          { p: "Go to Settings → Two-step sign-in → Move to a new phone while you still have the old one." },
          { tip: "Parents and Scouts don't need two-step sign-in unless they also hold a leader position." },
        ],
      },
    ],
  },
  {
    slug: "members", title: "Members", blurb: "Your roster, families, positions and who can do what.",
    articles: [
      {
        slug: "members-page", title: "The Members page", who: "Leaders",
        summary: "Everyone in the troop on one list, with search, filters and an edit panel per person.",
        body: [
          { p: "People → Members lists everyone active in the troop. Filter to Scouts, Adults, Leaders, Inactive or Everyone, or search by name. Chips flag missing or expired YPT and Scouts who turned 18." },
          { p: "Click a name to open that person's overview: rank, merit badges, nights camped, service hours, positions, parents, family balance, health and form status, and YPT. You only see the parts your position allows." },
          { h: "Editing someone (admins)" },
          { list: [
            "Role and troop position",
            "YPT and registration expiration dates (adults)",
            "Unit admin and designated leader checkboxes (adults)",
            "Which merit badges a counselor may sign off",
            "Which family a Scout belongs to (a Scout can be in two, for parents in separate homes)",
          ] },
          { tip: "Download roster gives you a spreadsheet. Update all lets you change many people at once." },
        ],
      },
      {
        slug: "add-and-remove", title: "Add, deactivate or merge members", who: "Admins",
        summary: "Add people without an account, take people off the active roster without losing history, and fix duplicates.",
        body: [
          { h: "Add someone directly" },
          { p: "On People → Members choose + Add member. Use it for people without an account yet, then give their family a claim code so they can take over the record." },
          { h: "Someone leaves" },
          { p: "Open them, choose Edit, then Deactivate. They drop off rosters and messages, but their advancement, attendance and payment history stay. Restore brings them back exactly as they were, roles and family included." },
          { h: "Duplicate records" },
          { p: "Open the record to keep, choose Merge a duplicate, and pick the other one. Sign-ups, attendance, forms, payments and advancement move over, and sign-offs keep the leader who actually signed them. Merging can't be undone." },
          { h: "Scout turns 18" },
          { p: "Members flags Scouts who turned 18. Open them and choose Convert to adult leader." },
        ],
      },
      {
        slug: "families", title: "Families and parents", who: "Everyone",
        summary: "How families, parents and Scouts are linked, and adding a co-parent.",
        body: [
          { p: "Each family has its parents or guardians and their Scouts. Parents see their Scouts' events, sign-ups, forms, advancement and the family balance on Family." },
          { h: "Add a spouse or co-parent" },
          { steps: [
            "On Family, choose Create family code.",
            "Give the code to the other parent. After they sign in, they enter it to join your family.",
          ] },
          { note: "Family codes work once and expire after 14 days." },
          { h: "Names, pronouns and gender" },
          { p: "When you sign up or add someone, and any time later under Edit about on Family, you can add the name they go by, their pronouns, the gender on their Scouting America registration, and anything leaders should know for tents or cabins." },
          { list: [
            "Goes-by names and pronouns are shown to the troop next to the name.",
            "The registration gender is there because troops are registered as boy or girl troops and Scoutbook needs it. It's private: only your family and leaders with private-detail access (current YPT) see it, and every look is logged.",
            "The tent and cabin note is private the same way.",
            "All of it is optional, and nothing in the app is blocked or sorted by it.",
          ] },
          { h: "Scouts with their own login" },
          { p: "When you add a child at sign-up, you can enter their own email if they have one. With your consent, they get their own login for sign-ups, advancement and messages. No email is fine: you can do everything for them from your account, and you get copies of every message to them. You can also set up their login later on Family. Scouts 13 and up do most things themselves; parents keep the final say on paid sign-ups if the troop chooses." },
        ],
      },
      {
        slug: "roster-privacy", title: "Who can see what on the roster", who: "Everyone",
        summary: "The roster is open to members; contact details are opt-in; private details need YPT.",
        body: [
          { list: [
            "Everyone in the troop sees names, patrols, ranks and positions.",
            "A family's phone and email show to other members only if that family opts in (Settings → Privacy).",
            "A Scout's own phone or email shows only to leaders.",
            "Birthdays, health form status and the message log are private details: only for leaders whose position allows it, with current YPT and two-step sign-in.",
            "Payment and form status never appear on the member roster.",
          ] },
        ],
      },
      {
        slug: "positions-and-access", title: "Positions and access", who: "Admins",
        summary: "Access comes from positions. Each position has a set of abilities you control.",
        body: [
          { p: "People → Positions & access lists your troop's positions (Scoutmaster, Treasurer, Advancement Chair and so on) and what each one can do: manage members, see private details, record health forms, view or manage money, manage events, edit the website, and more." },
          { steps: [
            "Open a position to change its abilities.",
            "Assign people to it. Their access changes right away.",
            "Every change is written to the Activity log with who made it.",
          ] },
          { note: "A troop always keeps at least one admin; the last one can't be removed. Keep two so nobody gets locked out." },
        ],
      },
      {
        slug: "patrols", title: "Patrols and youth positions", who: "Leaders",
        summary: "Set up patrols, move Scouts between them, and track youth leadership time for rank.",
        body: [
          { p: "People → Patrols & positions holds your patrols and the youth positions of responsibility (Senior Patrol Leader, Patrol Leader, Quartermaster and the rest)." },
          { list: [
            "Moving a Scout between patrols keeps their history with dates.",
            "Starting or ending a patrol leader updates their leadership time.",
            "Leadership time shows on each Scout's advancement page and counts toward Star, Life and Eagle.",
          ] },
          { tip: "Patrol leaders can message their own patrol; parents and leaders get copies automatically." },
        ],
      },
    ],
  },
  {
    slug: "events", title: "Events", blurb: "Calendar, sign-ups, waitlists, attendance and trip planning.",
    articles: [
      {
        slug: "create-event", title: "Create an event", who: "Leaders",
        summary: "Post a meeting, campout or service project with cost, deadline, cap and questions.",
        body: [
          { steps: [
            "Go to Calendar → Events → + New event. Or open last year's event and choose Copy this event; its trip plan comes along with checkboxes cleared.",
            "Fill in title, kind, start and end, and place.",
            "Optional: cost per person, sign-up deadline, refund rule, a cap on how many can go, a permission slip, and questions to ask each family (like T-shirt size).",
            "Nights camped, service hours and miles fill in for you from the dates; change them if needed. Present Scouts get the credit automatically.",
            "Choose who can see it: members only, or public on your troop website.",
            "Save.",
          ] },
          { h: "Weekly meetings" },
          { p: "For a meeting, set Repeat every week until. One meeting is created per week, each with its own sign-ups and attendance, and everything you filled in (description, cost, cap, permission slip, hours) goes to every meeting." },
          { h: "Changing an event later" },
          { list: [
            "Change the time or place, and families who signed up are told once.",
            "Raise or remove the cap, and people move up from the waitlist automatically.",
            "Change the price, and families already signed up keep the price they were charged; only new sign-ups pay the new one. The form asks you to confirm.",
          ] },
        ],
      },
      {
        slug: "sign-ups", title: "Sign-ups, waitlists and refunds", who: "Everyone",
        summary: "How families sign up, what they're charged, and what happens when they cancel.",
        body: [
          { p: "Families open the event and sign up each person. Adults can say they're driving and how many seats they have. The cost goes on the family balance right away." },
          { list: [
            "Full event: new sign-ups join the waitlist in order and move up when a spot opens. They're charged when they get a spot.",
            "Deadline: after it, families can't add new sign-ups (they can still cancel). Leaders can still add anyone.",
            "Canceling before the deadline: full credit. After it, the event's refund rule decides (full, half, or none).",
            "After the event is over, families can't sign up or cancel. Ask a leader to fix anything.",
          ] },
          { h: "Automatic nudges" },
          { p: "If a Scout hasn't answered 48 hours before the sign-up deadline (or about 3 days before an outing with no deadline), their parents get a reminder naming them, like \"Jake hasn't answered for the Fall Campout.\" Scouts with their own login get a nudge too. Families who already answered aren't bothered." },
          { h: "Scouts signing themselves up" },
          { p: "Unit settings decide what happens when a Scout with a login signs up for a paid event. By default the sign-up waits for a parent's OK, and nothing is charged until a parent approves." },
          { h: "Families who owe" },
          { p: "Your troop can block new sign-ups for families who owe more than a set amount (Unit → Unit settings). Leaders can still add anyone." },
        ],
      },
      {
        slug: "event-page", title: "The event page for leaders", who: "Leaders",
        summary: "Who's going, who's ready, two-deep leadership, seats and nudges in one place.",
        body: [
          { list: [
            "Who's going, not going, waitlisted and hasn't answered, with patrols.",
            "Ready to go?: who's missing a current health form (Part C too for trips over 72 hours or high adventure), a permission slip, or YPT.",
            "Two-deep check: at least two registered adults 21 or older with current YPT whenever Scouts are going.",
            "Seats offered by drivers against people going.",
            "Nudge: one reminder to families who haven't answered.",
            "Trip plan and trip sheet: itinerary, packing, meals, duty roster, permits and the printable sheet to bring.",
          ] },
        ],
      },
      {
        slug: "attendance", title: "Attendance and check-in", who: "Leaders",
        summary: "Mark who came, use QR check-in, and see sign-ups against who actually came.",
        body: [
          { steps: [
            "Open the event and choose Attendance.",
            "Mark each person present or absent. Each tap saves; taps made while saving aren't lost.",
            "For QR check-in, show the event's code. Self check-ins wait until a leader confirms them before they count.",
          ] },
          { p: "Once attendance is taken, the event page shows RSVP vs who came: came as planned, no-shows, walk-ins, and people who said no but came anyway." },
          { note: "Attendance never changes charges or sign-ups. Present Scouts automatically get the event's nights, service hours and miles." },
          { tip: "Calendar → Attendance shows meetings, outings, nights and service hours per Scout for any date range." },
        ],
      },
      {
        slug: "linked-units", title: "Linked units", who: "Admins",
        summary: "Share events with a partner troop so their families can sign up too.",
        body: [
          { p: "Link with another unit in Unit → Unit settings → Linked units. Events marked to share appear on their calendar. Their families sign up and pay through their own troop's account, and you don't see private details about their Scouts." },
        ],
      },
    ],
  },
  {
    slug: "messages", title: "Messages", blurb: "Safe, logged messaging with automatic copies to parents and leaders.",
    articles: [
      {
        slug: "send-message", title: "Send a message", who: "Leaders",
        summary: "Write to the whole troop, a group, an event's families, or chosen people.",
        body: [
          { steps: ["Go to Messages → New message.", "Choose who it's for.", "Write it and choose Send."] },
          { h: "Who you can send to" },
          { list: [
            "Everyone active in the unit",
            "All Scouts (parents and leaders get a copy)",
            "All parents and guardians",
            "All adults",
            "Everyone going to an event",
            "Families who haven't replied to an event",
            "Families who owe money (parents only; also open to the treasurer)",
            "A patrol (patrol leaders can message their own)",
            "Pick people",
          ] },
          { tip: "If several group messages already went out this week, you'll see a reminder. Families tune out when there are too many." },
        ],
      },
      {
        slug: "youth-protection-messaging", title: "How messages protect Scouts", who: "Everyone",
        summary: "No private threads with Scouts, ever.",
        body: [
          { list: [
            "Every message to a Scout is copied to that Scout's parents and to the troop's designated leaders.",
            "Messages are saved permanently. Nobody can edit or delete them, including admins and our staff.",
            "Replies to emails that involve a Scout come back into the app, not to anyone's personal inbox.",
            "Only a parent or guardian can ask to delete their child's data.",
            "Leaders with access to the message log can review it; each look at it is recorded.",
          ] },
        ],
      },
      {
        slug: "email-and-texts", title: "Email, texts and unsubscribing", who: "Everyone",
        summary: "What we send, how to change it, and why some emails don't arrive.",
        body: [
          { p: "Choose what you get in Settings: email, text (adults only, with consent), categories, and quiet hours. Urgent notices like a canceled event come through quiet hours." },
          { p: "Every email has an unsubscribe link, and mail apps show their own one-click unsubscribe button. Unsubscribing stops unit email; messages still show in the app." },
          { h: "Emails that don't arrive" },
          { p: "If an address bounces for good or someone marks our email as spam, we stop emailing it. People → Reports → Who we can't reach lists them, along with Scouts with no parent signed up and adults without an account. For a bad address, get a new one and update their profile." },
        ],
      },
    ],
  },
  {
    slug: "advancement", title: "Advancement", blurb: "Requirements, sign-offs, merit badges, awards and Scoutbook.",
    articles: [
      {
        slug: "sign-offs", title: "Requirements and sign-offs", who: "Leaders and counselors",
        summary: "Scouts mark work done; leaders and counselors sign it off.",
        body: [
          { steps: [
            "Scouts (or parents) mark requirements done on the Scout's advancement page.",
            "Advancement shows everything waiting for a sign-off.",
            "Sign one at a time, or use Sign everything I can.",
          ] },
          { list: [
            "Unit leaders can sign any requirement.",
            "Merit badge counselors sign only the badges they're approved for, and only for Scouts assigned to them.",
            "Every sign-off is recorded with who signed it, and stays that way even if records are merged later.",
          ] },
        ],
      },
      {
        slug: "trail-to-first-class", title: "Trail to First Class and skill modules", who: "Leaders and Scouts",
        summary: "See where new Scouts stand, plan what each meeting teaches, and let Scouts practice ahead.",
        body: [
          { p: "New Scouts usually work on Scout, Tenderfoot, Second Class and First Class together in their first year. Each Scout's advancement page shows how far along they are, what to work on next, and what's waiting for a sign-off." },
          { h: "For leaders" },
          { steps: [
            "Advancement → Trail to First Class lists every Scout still on the trail and the requirements most of them still need, so you can teach one thing that moves the whole group forward.",
            "Advancement → Skill modules is your troop's library of skills (knots, first aid, cooking, navigation...). Start with the ready-made Trail to First Class set or the Eagle-required merit badge set, then edit any of them.",
            "A module can cover requirements from any rank or merit badge. Search to find them, and add notes (what to bring) and links to videos or guides.",
            "Give a module a meeting date to schedule it.",
          ] },
          { h: "For Scouts" },
          { p: "Scheduled skills show at the top of your advancement page under Coming up at meetings, with what's done, what's waiting and what's left for you, plus the leader's videos and a Find a video search for each requirement. Practice before the meeting and you'll be ready to get it signed off." },
        ],
      },
      {
        slug: "merit-badges", title: "Merit badges and counselors", who: "Leaders",
        summary: "Scouts ask to start a badge, a leader approves and assigns a counselor.",
        body: [
          { steps: [
            "A Scout asks to start a merit badge.",
            "Advancement shows the request. Choose Approve & assign counselor.",
            "The counselor signs requirements as the Scout finishes them.",
          ] },
          { p: "Approve counselors for specific badges on People → Members (open the counselor, choose Edit). People → Reports → Merit badge counselors by badge lists them." },
        ],
      },
      {
        slug: "awards", title: "Awards and Court of Honor", who: "Advancement chair",
        summary: "Track awards to buy and present, print the shopping list, program and labels.",
        body: [
          { steps: [
            "Advancement → Awards lists everything earned but not yet presented.",
            "Print shopping list and program gives you the Scout Shop list with counts and a ceremony program.",
            "Print award labels prints one label per award on Avery 5160 sheets (30 per page). Print at 100% scale.",
            "Mark awards bought, then presented.",
          ] },
          { note: "Council Scout Shops usually need an advancement report from Scoutbook first. See Scoutbook." },
        ],
      },
      {
        slug: "eagle", title: "Eagle candidates", who: "Leaders",
        summary: "Track Eagle progress, projects and time before 18.",
        body: [
          { p: "Advancement → Eagle shows Scouts working toward Eagle, their project from proposal to board of review, and how long they have before turning 18." },
        ],
      },
      {
        slug: "scoutbook", title: "Scoutbook", who: "Advancement chair",
        summary: "Keep Scoutbook up to date with what's signed off here.",
        body: [
          { steps: [
            "When Advancement says items aren't in Scoutbook yet, download the upload file.",
            "Import it in Scoutbook Plus.",
            "Items in a downloaded file count as sent, so Advancement says Scoutbook is up to date until something new is signed off. Full history file gives you everything again if you need it.",
          ] },
          { p: "You can also import advancement history from Scoutbook under Unit → Import & export." },
        ],
      },
    ],
  },
  {
    slug: "money", title: "Money", blurb: "Balances, card payments, cash and checks, dues and Scout accounts.",
    articles: [
      {
        slug: "payment-setup", title: "Set up payments", who: "Treasurer",
        summary: "Choose how families pay and who covers card fees.",
        body: [
          { steps: [
            "Go to Unit → Unit settings. Under How families can pay, choose card, cash and check, or both, and choose who pays the card fee.",
            "For card payments, connect the troop's bank account on Money (through Stripe). Money goes straight to the troop, not to us.",
          ] },
          { tip: "Cash and checks are always free. Families who want to avoid the card fee can pay the treasurer in person." },
        ],
      },
      {
        slug: "family-balances", title: "Family balances and paying", who: "Families and treasurer",
        summary: "Event costs and dues add up on one family balance. Families pay it online or in person.",
        body: [
          { p: "Sign-ups, dues and charges raise the family balance; payments and credits lower it. Families see their balance and history on Family and pay on Pay." },
          { list: [
            "Card payments are for at least 50 cents and never more than what's owed.",
            "The payment goes to the family this troop bills, even if the parent is also in another unit.",
          ] },
          { h: "Cash or check" },
          { p: "The treasurer records it on Money → Record cash or check. It shows in the family's history marked as manual." },
        ],
      },
      {
        slug: "who-owes", title: "Who owes and reminders", who: "Treasurer",
        summary: "See who owes the most and send one reminder to all of them.",
        body: [
          { p: "Money → Families lists families by what they owe, largest first. Message families who owe sends one message to their parents (never to the Scouts)." },
        ],
      },
      {
        slug: "dues", title: "Yearly dues", who: "Treasurer",
        summary: "Charge dues to every family in one step, with adjustments for anyone who needs one.",
        body: [
          { steps: [
            "On Money, open Dues and set up a plan (name and amount).",
            "Charge it. Each member's family gets the charge once, even if you run it again.",
            "Give a credit to anyone who needs an adjustment, with a reason.",
          ] },
        ],
      },
      {
        slug: "scout-accounts", title: "Scout accounts", who: "Treasurer and families",
        summary: "Money a Scout earns from fundraising, which can be applied to the family balance.",
        body: [
          { p: "Fundraising credit goes into the Scout's own account. A parent or the treasurer can apply it to what the family owes, up to the amount owed and never more than the account holds." },
        ],
      },
    ],
  },
  {
    slug: "safety", title: "Safety and admin", blurb: "Health forms, YPT, the activity log, reports and settings.",
    articles: [
      {
        slug: "health-forms", title: "Health forms and swim checks", who: "Designated leaders",
        summary: "Record that forms were received and when they expire. The forms themselves stay on paper.",
        body: [
          { steps: [
            "Families download the blank Annual Health and Medical Record from Forms and hand the paper form to a designated leader.",
            "Go to Safety → Health forms & YPT. Tap a part (Health A+B, Health C, Permission, Tetanus, Swim check) and enter the date.",
            "We work out the expiry: health forms run to the end of the 12th month after the exam, tetanus 10 years, swim checks a year.",
          ] },
          { p: "Use the Show filter to find Missing, Expired, or expiring within 30, 60 or 90 days, then Print the list before a campout. Swim class shows next to each name." },
          { note: "Nobody uploads medical forms. Only status and dates are stored." },
          { tip: "Families get reminders 30 and 7 days before a form expires." },
        ],
      },
      {
        slug: "ypt", title: "Youth Protection Training", who: "Admins",
        summary: "Leaders need current YPT to see private details about Scouts.",
        body: [
          { list: [
            "Enter each leader's YPT expiration on People → Members (Edit).",
            "Leaders whose YPT is missing or expired keep using other tools, but lose private details, health form status and the message log until it's renewed. The app tells them why.",
            "Admins need current YPT too.",
            "Reminders go out 30 and 7 days before it expires. People → Reports → YPT aging lists everyone.",
          ] },
        ],
      },
      {
        slug: "activity-log", title: "Activity log", who: "Admins",
        summary: "Who did what and when. Entries can't be edited or deleted.",
        body: [
          { p: "Safety → Activity log shows recent changes: members added, roles and admin changes, positions, sign-ups, sign-offs, forms, looks at private details, Scoutbook files, merges and more." },
          { list: [
            "Filter by date range, type of change, and who did it.",
            "Privacy and access only narrows it to the sensitive entries.",
          ] },
        ],
      },
      {
        slug: "reports", title: "Reports", who: "Leaders",
        summary: "Ready-made printable lists.",
        body: [
          { p: "People → Reports has: YPT aging, patrol rosters, leaders by position, swim test results, merit badge counselors by badge, shirt sizes, allergies and dietary needs, registration renewals, Scout and parent cross reference, who we can't reach, participation for the last 12 months, and youth positions. Each one prints." },
        ],
      },
      {
        slug: "unit-settings", title: "Unit settings", who: "Admins",
        summary: "Your troop's details and how the troop works.",
        body: [
          { list: [
            "Unit name, city and state",
            "When a Scout with a login RSVPs (for example, a parent approves paid sign-ups)",
            "Family contact info on the member roster (the default for sharing)",
            "How families can pay, and who pays the card fee",
            "Block new sign-ups when a family owes more than an amount",
            "Reimbursements over an amount need a second approver",
            "Linked units",
          ] },
          { p: "Your public troop website is under Unit → Website: pages, photos, calendar and a contact form, each public or members-only." },
        ],
      },
      {
        slug: "deleting-data", title: "Deleting a child's data", who: "Parents",
        summary: "Only a parent or guardian can ask for their child's data to be deleted.",
        body: [
          { p: "In Settings → Privacy, a parent or guardian can ask to delete a family member's data, including message history. Leaders, admins, Scouts and our staff can't. Adults can ask for their own data to be deleted the same way." },
        ],
      },
    ],
  },
];

export const ALL = SECTIONS.flatMap((s) => s.articles.map((a) => ({ ...a, section: s })));
export const findArticle = (slug: string) => ALL.find((a) => a.slug === slug);

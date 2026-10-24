# Going live on ourtroopmanager.com

Steps that need your logins. Everything else is done in the code.

## 1. Database (5 minutes)
```
npx supabase db push
```
Pushes migrations 0042-0078. The site works without them, but the newer features stay hidden.

## 2. Cloudflare (the site runs on Cloudflare Workers, next to the domain)
Config is in `wrangler.jsonc`; the build adapter is OpenNext. The site address and time zone are already set there.
1. Sign Cloudflare's command-line tool in to your account (opens a browser; click Allow):
   `npx wrangler login`
2. Upload the two secrets (the service key and the reminder-job password) from the prepared, git-ignored file:
   `npx wrangler secret bulk .env.cloudflare-secrets.local`
3. Build and publish:
   `npm run deploy`
   This also attaches ourtroopmanager.com and www.ourtroopmanager.com and turns on the daily reminder job.

Build-time settings come from `.env.production.local` (git-ignored, already filled in). Bundle is about 2.8 MB compressed; the free Workers plan allows 3 MB, so move to Workers Paid ($5/month) when it grows.

## 3. Supabase sign-in settings (2 minutes)
Supabase dashboard → Authentication → URL Configuration:
- Site URL: `https://ourtroopmanager.com`
- Redirect URLs: add `https://ourtroopmanager.com/**`

Google sign-in: in Google Cloud Console, add `https://ourtroopmanager.com` to the OAuth client's authorized origins.

## 4. Email (Resend, 15 minutes)
1. Create a Resend account and add the domain **ourtroopmanager.com**.
2. Copy the DNS records Resend shows into Cloudflare → ourtroopmanager.com → DNS. Wait for Resend to say Verified.
3. Add as Cloudflare secrets (`npx wrangler secret put NAME`): `RESEND_API_KEY`, `EMAIL_FROM` = `Our Troop Manager <notify@ourtroopmanager.com>`, `EMAIL_FROM_ADDRESS` = `mail@ourtroopmanager.com`.
4. Resend → Webhooks → add `https://ourtroopmanager.com/api/webhooks/resend` for **email.bounced** and **email.complained**; put its signing secret in `RESEND_WEBHOOK_SECRET`.
5. Run `npm run deploy` again (EMAIL_FROM values can go in wrangler.jsonc vars instead).

## 5. Payments (Stripe)
1. Create a Stripe account with Connect enabled.
2. Add `STRIPE_SECRET_KEY` as a Cloudflare secret.
3. Stripe → Developers → Webhooks → add `https://ourtroopmanager.com/api/stripe/webhook`; put its secret in `STRIPE_WEBHOOK_SECRET`.
4. Run `npm run deploy`. Each troop's treasurer then connects their bank on Money.

## 6. Texts (Twilio, later)
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`; point the number's incoming-message webhook at `https://ourtroopmanager.com/api/sms/inbound`. Carrier (10DLC) registration takes a few weeks, so start it early.

## 7. iPhone and Android apps (Capacitor, built in the cloud by Codemagic)
The apps are a native shell around the live site (`capacitor.config.ts`), so website releases reach them
without a new build. Build again only when icons, plugins or permissions change.

One-time Apple setup (you, signed in to your Apple Developer account):
1. developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → **+** → App IDs → App.
   Description `Our Troop Manager`, Bundle ID (explicit) `com.ourtroopmanager.app`. Tick **Push Notifications**. Register.
2. appstoreconnect.apple.com → Apps → **+** → New App: iOS, name `Our Troop Manager`, language English (U.S.),
   bundle ID `com.ourtroopmanager.app`, SKU `ourtroopmanager`. After it's created, copy its **Apple ID** number
   (App Information page).
3. App Store Connect → Users and Access → Integrations → App Store Connect API → **+**: name `Codemagic`,
   access **Admin**. Download the .p8 file (only once!) and note the **Key ID** and **Issuer ID**.

One-time Codemagic setup:
4. codemagic.io → sign up with GitHub → add the `scouts-platform` repository.
5. Team settings → Integrations → Developer Portal → connect: name it exactly `ASC key`, enter the Issuer ID,
   Key ID and upload the .p8.
6. In the app's workflow settings → Environment variables: add `APP_STORE_APPLE_ID` = the number from step 2.

Each test build:
7. Codemagic → Start new build → workflow **iOS → TestFlight**. About 20 minutes, then Apple processes it
   (15-30 minutes more).
8. App Store Connect → the app → TestFlight → Internal Testing → **+** group → add yourself. The invite shows in
   the TestFlight app on your iPhone. Install.
9. Android: start **Android → install file**, open the .apk download link on the Android phone, allow installing
   from that source, install.

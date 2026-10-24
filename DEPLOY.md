# Going live on ourtroopmanager.com

Steps that need your logins. Everything else is done in the code.

## 1. Database (5 minutes)
```
npx supabase db push
```
Pushes migrations 0042-0071. The site works without them, but the newer features stay hidden.

## 2. Vercel project (10 minutes)
1. Go to vercel.com (you're already signed in there for the domain), Add New → Project.
2. Import the GitHub repo **Damander1980/scouts-platform**. Framework: Next.js (detected). Leave build settings as they are.
3. Before the first deploy, open **Environment Variables** and add these (copy values from `.env.local`, except the two marked):

| Name | Value |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | from .env.local |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | from .env.local |
| SUPABASE_SERVICE_ROLE_KEY | from .env.local (keep secret) |
| CRON_SECRET | from .env.local |
| NEXT_PUBLIC_SITE_URL | **https://ourtroopmanager.com** |
| NEXT_PUBLIC_SITE_HOST | **ourtroopmanager.com** |
| NEXT_PUBLIC_TIME_ZONE | America/Chicago |

4. Deploy. The daily reminder job (vercel.json) is picked up automatically.
5. Project → Settings → Domains → add **ourtroopmanager.com** and **www.ourtroopmanager.com** (redirect www to the bare domain). Vercel sets the DNS itself because the domain is registered there.

## 3. Supabase sign-in settings (2 minutes)
Supabase dashboard → Authentication → URL Configuration:
- Site URL: `https://ourtroopmanager.com`
- Redirect URLs: add `https://ourtroopmanager.com/**`

Google sign-in: in Google Cloud Console, add `https://ourtroopmanager.com` to the OAuth client's authorized origins.

## 4. Email (Resend, 15 minutes)
1. Create a Resend account and add the domain **ourtroopmanager.com**.
2. Copy the DNS records Resend shows into Vercel → Domains → ourtroopmanager.com → DNS records. Wait for Resend to say Verified.
3. Add to Vercel env vars: `RESEND_API_KEY`, `EMAIL_FROM` = `Our Troop Manager <notify@ourtroopmanager.com>`, `EMAIL_FROM_ADDRESS` = `mail@ourtroopmanager.com`.
4. Resend → Webhooks → add `https://ourtroopmanager.com/api/webhooks/resend` for **email.bounced** and **email.complained**; put its signing secret in `RESEND_WEBHOOK_SECRET`.
5. Redeploy (Vercel → Deployments → Redeploy) so the new variables load.

## 5. Payments (Stripe)
1. Create a Stripe account with Connect enabled.
2. Add `STRIPE_SECRET_KEY` to Vercel.
3. Stripe → Developers → Webhooks → add `https://ourtroopmanager.com/api/stripe/webhook`; put its secret in `STRIPE_WEBHOOK_SECRET`.
4. Redeploy. Each troop's treasurer then connects their bank on Money.

## 6. Texts (Twilio, later)
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`; point the number's incoming-message webhook at `https://ourtroopmanager.com/api/sms/inbound`. Carrier (10DLC) registration takes a few weeks, so start it early.

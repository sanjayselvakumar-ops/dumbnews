# Dumb News Production Launch Plan

## 1. Configure Production Services

- Create a Supabase project and run `supabase/schema.sql` in the SQL editor.
- Enable Supabase email/password auth and configure production redirect URLs.
- Create a Stripe product named `Dumb News Pro` with a recurring `$2/month` Price.
- Add the Stripe webhook endpoint `/api/billing/webhook` and subscribe to checkout session and subscription events.
- Create `.env.local` locally and deployment environment variables from `.env.example`.
- Keep `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` server-only.

## 2. Verify Account And Membership Behavior

- Logged-out users must land on the auth page.
- Real Supabase sign up must create a session, then `/api/account` must create or load the user profile.
- Saved stories, read stories, settings, and membership state must persist after reload and across devices.
- Free users must receive exactly the latest 10 stories from `/api/brief`.
- Paid users must receive the full cached story set from `/api/brief`.
- Free users must poll every 10 minutes; paid users must poll every 5 minutes.
- Stripe Checkout must send payment to the connected Stripe account and return users to the app.
- Stripe webhooks must update `profiles.membership_tier` from `free` to `paid`, and back to `free` if the subscription is canceled or unpaid.

## 3. Verify News Ingestion And Quality

- Confirm all configured RSS feeds respond in production.
- Confirm NewsAPI.org responds in production and is only called by the backend.
- Confirm NewsAPI usage is protected by Supabase/cache freshness so users do not spend quota directly.
- Confirm normalized stories are upserted into Supabase `stories`.
- Confirm the app stores summaries, metadata, timestamps, categories, source names, and source links only.
- Review summary quality daily before launch; remove feeds with poor snippets or recurring low-quality summaries.
- Add a scheduled production job later so RSS ingestion happens in the background instead of only during user requests.
- Add Reuters/AP only through licensed APIs or verified public RSS access; do not scrape or republish full articles.

## 4. Pre-Release Testing

- Run `npm test`, `npm run lint`, and `npm run build`.
- Browser test desktop and mobile:
  - auth page
  - real sign up
  - log in
  - log out
  - free story cap
  - paid story unlock
  - save story
  - reload saved story
  - search
  - settings persistence
  - checkout and portal redirects
- Test with fresh browser profiles and multiple accounts.
- Test production webhooks using Stripe CLI before real payments.
- Check mobile Safari, mobile Chrome, desktop Chrome, and desktop Safari.

## 5. Deploy Publicly

- Deploy the Next.js app to Vercel.
- Set production environment variables in Vercel.
- Add the production domain to Supabase Auth allowed URLs.
- Add the production webhook URL to Stripe.
- Turn on HTTPS through Vercel.
- Run a production smoke test with a real free account and a real paid test-mode subscription.
- Switch Stripe from test mode to live mode only after the full test-mode flow works.

## 6. Launch Monitoring

- Monitor `/api/brief`, `/api/account`, and Stripe webhook errors.
- Track feed failure rate and story count.
- Track free-to-paid conversion and subscription cancellations in Stripe.
- Track average session length and completion rate.
- Add alerts for failed webhooks, failed RSS ingestion, and unusually low story counts.

# Dumb News

Minimal news app for reading the day in a few minutes.

## Local Development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000`.

## Required Environment

Copy `.env.example` to `.env.local` and fill in the real values:

```env
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_PRICE_ID=
STRIPE_WEBHOOK_SECRET=
```

Do not commit `.env.local`.

## Supabase Setup

Run `supabase/schema.sql` in the Supabase SQL editor.

Required tables:

- `profiles`
- `stories`
- `saved_stories`
- `read_stories`
- `user_settings`

## Stripe Setup

Create a recurring `$2/month` Stripe Price and set:

- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`

Webhook endpoint:

```text
https://your-domain.com/api/billing/webhook
```

Subscribe to:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## Verification

```bash
npm test
npm run lint
npm run build
```

## Deploy On Vercel

1. Push this repository to GitHub.
2. Import the GitHub repository into Vercel.
3. Add the environment variables from `.env.example`.
4. Set `NEXT_PUBLIC_APP_URL` to the production Vercel/domain URL.
5. Add the production URL to Supabase Auth allowed URLs.
6. Add the production Stripe webhook URL.
7. Deploy and test signup, login, save, settings, upgrade, and paid tier.

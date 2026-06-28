import Stripe from "stripe";

let stripe: Stripe | null = null;

export function getStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return null;
  }

  if (!stripe) {
    stripe = new Stripe(secretKey, {
      apiVersion: "2026-06-24.dahlia"
    });
  }

  return stripe;
}

export function getStripePriceId(): string | null {
  return process.env.STRIPE_PRICE_ID ?? null;
}

export function getAppUrl(request: Request): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
}

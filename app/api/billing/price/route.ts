import { NextResponse } from "next/server";
import { getStripeClient, getStripePriceId } from "@/lib/stripe";

export async function GET() {
  const stripe = getStripeClient();
  const priceId = getStripePriceId();

  if (!stripe || !priceId) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  const price = await stripe.prices.retrieve(priceId);
  const unitAmount = price.unit_amount ?? 0;
  const currency = price.currency.toUpperCase();
  const interval = price.recurring?.interval ?? "month";
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: unitAmount % 100 === 0 ? 0 : 2
  }).format(unitAmount / 100);

  return NextResponse.json({
    id: price.id,
    currency,
    unitAmount,
    interval,
    display: `${amount} / ${interval}`
  });
}

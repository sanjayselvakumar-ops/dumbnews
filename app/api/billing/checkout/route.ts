import { NextResponse } from "next/server";
import { getAppUrl, getStripeClient, getStripePriceId } from "@/lib/stripe";
import { ensureProfile, getAuthContext } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const context = await getAuthContext(request);
  const stripe = getStripeClient();
  const priceId = getStripePriceId();

  if (!context.configured) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  if (!stripe || !priceId) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const user = context.user;
  const profile = await ensureProfile(context.admin, user);
  const appUrl = getAppUrl(request);
  const customerId =
    profile.stripeCustomerId ??
    (
      await stripe.customers.create({
        email: profile.email,
        metadata: {
          user_id: user.id
        }
      })
    ).id;

  if (!profile.stripeCustomerId) {
    await context.admin.from("profiles").update({ stripe_customer_id: customerId }).eq("user_id", user.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/?billing=success`,
    cancel_url: `${appUrl}/?billing=cancelled`,
    metadata: {
      user_id: user.id
    },
    subscription_data: {
      metadata: {
        user_id: user.id
      }
    }
  });

  return NextResponse.json({ url: session.url });
}

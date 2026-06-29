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
  if (profile.membershipTier === "paid") {
    return NextResponse.json({ error: "This account already has Pro access." }, { status: 409 });
  }

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

  await stripe.customers.update(customerId, {
    email: profile.email || user.email || undefined,
    metadata: {
      user_id: user.id
    }
  });

  if (!profile.stripeCustomerId) {
    const { error } = await context.admin
      .from("profiles")
      .update({
        stripe_customer_id: customerId,
        stripe_price_id: priceId,
        billing_updated_at: new Date().toISOString()
      })
      .eq("user_id", user.id);
    if (error) {
      await context.admin.from("profiles").update({ stripe_customer_id: customerId }).eq("user_id", user.id);
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/account?billing=success`,
    cancel_url: `${appUrl}/account?billing=cancelled`,
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

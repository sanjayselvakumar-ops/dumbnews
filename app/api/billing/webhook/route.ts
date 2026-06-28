import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const stripe = getStripeClient();
  const admin = getSupabaseAdminClient();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !admin || !signature || !webhookSecret) {
    return NextResponse.json({ error: "Billing webhook is not configured." }, { status: 503 });
  }

  let event: Stripe.Event;
  const payload = await request.text();

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    await syncSubscription(event, admin);
  }

  return NextResponse.json({ received: true });
}

async function syncSubscription(event: Stripe.Event, admin: NonNullable<ReturnType<typeof getSupabaseAdminClient>>) {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;

    if (userId) {
      await admin
        .from("profiles")
        .update({
          membership_tier: "paid",
          stripe_customer_id: typeof session.customer === "string" ? session.customer : session.customer?.id,
          stripe_subscription_id:
            typeof session.subscription === "string" ? session.subscription : session.subscription?.id
        })
        .eq("user_id", userId);
    }
    return;
  }

  const subscription = event.data.object as Stripe.Subscription;
  const userId = subscription.metadata?.user_id;
  const tier = subscription.status === "active" || subscription.status === "trialing" ? "paid" : "free";

  if (userId) {
    await admin
      .from("profiles")
      .update({
        membership_tier: tier,
        stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
        stripe_subscription_id: subscription.id
      })
      .eq("user_id", userId);
    return;
  }

  await admin
    .from("profiles")
    .update({
      membership_tier: tier,
      stripe_subscription_id: subscription.id
    })
    .eq("stripe_customer_id", typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id);
}

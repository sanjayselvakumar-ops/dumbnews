import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseAdminClient, updateProfileSubscription } from "@/lib/supabase/server";

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
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted" ||
    event.type === "invoice.payment_succeeded"
  ) {
    await syncSubscription(event, admin, stripe);
  }

  return NextResponse.json({ received: true });
}

async function syncSubscription(
  event: Stripe.Event,
  admin: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  stripe: NonNullable<ReturnType<typeof getStripeClient>>
) {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id ?? session.client_reference_id ?? undefined;
    const subscription =
      typeof session.subscription === "string"
        ? await stripe.subscriptions.retrieve(session.subscription)
        : session.subscription;

    if (userId && subscription && typeof subscription !== "string") {
      await updateProfileSubscription(admin, userId, subscriptionProfileFields(subscription));
    } else if (userId) {
      await updateProfileSubscription(admin, userId, {
        stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
        stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : undefined,
        subscriptionStatus: "active"
      });
    }
    return;
  }

  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null };
    const nestedSubscription = invoice.parent?.subscription_details?.subscription;
    const subscriptionRef = invoice.subscription ?? nestedSubscription;
    const subscriptionId = typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id;
    if (!subscriptionId) {
      return;
    }
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await syncSubscriptionByRecord(admin, subscription);
    return;
  }

  await syncSubscriptionByRecord(admin, event.data.object as Stripe.Subscription);
}

async function syncSubscriptionByRecord(
  admin: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  subscription: Stripe.Subscription
) {
  const userId = subscription.metadata?.user_id;
  if (userId) {
    await updateProfileSubscription(admin, userId, subscriptionProfileFields(subscription));
    return;
  }

  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const { data } = await admin.from("profiles").select("user_id").eq("stripe_customer_id", customerId).maybeSingle();
  if (data?.user_id) {
    await updateProfileSubscription(admin, data.user_id, subscriptionProfileFields(subscription));
  }
}

function subscriptionProfileFields(subscription: Stripe.Subscription) {
  const firstItem = subscription.items.data[0];
  const currentPeriodEnd =
    firstItem?.current_period_end ? new Date(firstItem.current_period_end * 1000).toISOString() : null;

  return {
    stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
    stripeSubscriptionId: subscription.id,
    stripePriceId: firstItem?.price.id ?? null,
    subscriptionStatus: subscription.status,
    currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancel_at_period_end
  };
}

import { NextResponse } from "next/server";
import { getAppUrl, getStripeClient } from "@/lib/stripe";
import { ensureProfile, getAuthContext } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const context = await getAuthContext(request);
  const stripe = getStripeClient();

  if (!context.configured) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const user = context.user;
  const profile = await ensureProfile(context.admin, user);

  if (!profile.stripeCustomerId) {
    return NextResponse.json({ error: "No Stripe customer exists for this account." }, { status: 400 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripeCustomerId,
    return_url: `${getAppUrl(request)}/account`
  });

  return NextResponse.json({ url: session.url });
}

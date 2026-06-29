import type { MembershipTier } from "./news/types";

export const FREE_STORY_LIMIT = 10;
export const FREE_REFRESH_MS = 1000 * 60 * 10;
export const PAID_REFRESH_MS = 1000 * 60 * 5;

export type AccountProfile = {
  email: string;
  membershipTier: MembershipTier;
  subscriptionStatus?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean | null;
  billingUpdatedAt?: string | null;
};

export function membershipTierFromSubscriptionStatus(status?: string | null): MembershipTier {
  return status === "active" || status === "trialing" ? "paid" : "free";
}

export function refreshIntervalForTier(tier: MembershipTier): number {
  return tier === "paid" ? PAID_REFRESH_MS : FREE_REFRESH_MS;
}

export function storyLimitForTier(tier: MembershipTier): number | null {
  return tier === "paid" ? null : FREE_STORY_LIMIT;
}

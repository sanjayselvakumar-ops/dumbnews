import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { StoredState } from "@/lib/app-storage";
import type { NewsStory } from "@/lib/news/types";
import { defaultStoredState } from "@/lib/app-storage";
import { membershipTierFromSubscriptionStatus, type AccountProfile } from "@/lib/membership";
import { getSupabasePublicConfig, getSupabaseServerConfig } from "./config";

type DatabaseStory = {
  id: string;
  category: NewsStory["category"];
  headline: string;
  summary: string;
  source: string;
  source_url: string;
  published_at: string;
  why_it_matters: string;
  background: string | null;
};

export type AuthContext =
  | { configured: false; user: null; admin: null }
  | { configured: true; user: User | null; admin: SupabaseClient };

export function getSupabaseAdminClient(): SupabaseClient | null {
  const config = getSupabaseServerConfig();
  if (!config) {
    return null;
  }

  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export async function getAuthContext(request: Request): Promise<AuthContext> {
  const publicConfig = getSupabasePublicConfig();
  const admin = getSupabaseAdminClient();

  if (!publicConfig || !admin) {
    return { configured: false, user: null, admin: null };
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return { configured: true, user: null, admin };
  }

  const userClient = createClient(publicConfig.url, publicConfig.anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  const { data } = await userClient.auth.getUser(token);

  return { configured: true, user: data.user ?? null, admin };
}

export async function ensureProfile(admin: SupabaseClient, user: User): Promise<AccountProfile> {
  const email = user.email ?? "";
  const profileQuery = await admin
    .from("profiles")
    .select(
      "email,membership_tier,subscription_status,stripe_customer_id,stripe_subscription_id,stripe_price_id,current_period_end,cancel_at_period_end,billing_updated_at"
    )
    .eq("user_id", user.id)
    .maybeSingle();
  let existing = profileQuery.data;

  if (profileQuery.error) {
    const fallbackQuery = await admin
      .from("profiles")
      .select("email,membership_tier,stripe_customer_id,stripe_subscription_id")
      .eq("user_id", user.id)
      .maybeSingle();
    existing = fallbackQuery.data
      ? {
          ...fallbackQuery.data,
          subscription_status: fallbackQuery.data.membership_tier === "paid" ? "active" : "free",
          stripe_price_id: null,
          current_period_end: null,
          cancel_at_period_end: false,
          billing_updated_at: null
        }
      : null;
  }

  if (!existing) {
    const { error } = await admin.from("profiles").insert({
      user_id: user.id,
      email,
      membership_tier: "free",
      subscription_status: "free"
    });
    if (error) {
      await admin.from("profiles").insert({
        user_id: user.id,
        email,
        membership_tier: "free"
      });
    }
  }

  const profile = existing ?? {
    email,
    membership_tier: "free",
    subscription_status: "free",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    stripe_price_id: null,
    current_period_end: null,
    cancel_at_period_end: false,
    billing_updated_at: null
  };
  const membershipTier =
    profile.subscription_status && profile.subscription_status !== "free"
      ? membershipTierFromSubscriptionStatus(profile.subscription_status)
      : profile.membership_tier === "paid"
        ? "paid"
        : "free";

  return {
    email: profile.email ?? email,
    membershipTier,
    subscriptionStatus: profile.subscription_status,
    stripeCustomerId: profile.stripe_customer_id,
    stripeSubscriptionId: profile.stripe_subscription_id,
    stripePriceId: profile.stripe_price_id,
    currentPeriodEnd: profile.current_period_end,
    cancelAtPeriodEnd: profile.cancel_at_period_end,
    billingUpdatedAt: profile.billing_updated_at
  };
}

export async function updateProfileSubscription(
  admin: SupabaseClient,
  userId: string,
  fields: {
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
    subscriptionStatus?: string | null;
    currentPeriodEnd?: string | null;
    cancelAtPeriodEnd?: boolean | null;
  }
) {
  const membershipTier = membershipTierFromSubscriptionStatus(fields.subscriptionStatus);

  const { error } = await admin
    .from("profiles")
    .update({
      membership_tier: membershipTier,
      subscription_status: fields.subscriptionStatus ?? "free",
      stripe_customer_id: fields.stripeCustomerId ?? null,
      stripe_subscription_id: fields.stripeSubscriptionId ?? null,
      stripe_price_id: fields.stripePriceId ?? null,
      current_period_end: fields.currentPeriodEnd ?? null,
      cancel_at_period_end: fields.cancelAtPeriodEnd ?? false,
      billing_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("user_id", userId);

  if (!error) {
    return;
  }

  await admin
    .from("profiles")
    .update({
      membership_tier: membershipTier,
      stripe_customer_id: fields.stripeCustomerId ?? null,
      stripe_subscription_id: fields.stripeSubscriptionId ?? null,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", userId);
}

export async function loadUserState(admin: SupabaseClient, userId: string): Promise<StoredState> {
  const [saved, read, settings] = await Promise.all([
    admin.from("saved_stories").select("story_id").eq("user_id", userId),
    admin.from("read_stories").select("story_id,read_at").eq("user_id", userId),
    admin.from("user_settings").select("theme,font_size,categories,notification_time").eq("user_id", userId).maybeSingle()
  ]);

  const readIdsByDate: StoredState["readIdsByDate"] = {};
  for (const row of read.data ?? []) {
    const day = new Date(row.read_at).toISOString().slice(0, 10);
    readIdsByDate[day] = [...(readIdsByDate[day] ?? []), row.story_id];
  }

  return {
    ...defaultStoredState,
    savedIds: (saved.data ?? []).map((row) => row.story_id),
    readIdsByDate,
    settings: settings.data
      ? {
          theme: settings.data.theme ?? defaultStoredState.settings.theme,
          fontSize: settings.data.font_size ?? defaultStoredState.settings.fontSize,
          categories: settings.data.categories ?? defaultStoredState.settings.categories,
          notificationTime: settings.data.notification_time ?? defaultStoredState.settings.notificationTime
        }
      : defaultStoredState.settings
  };
}

export async function loadSavedNewsStories(admin: SupabaseClient, userId: string): Promise<NewsStory[]> {
  const { data: savedRows } = await admin
    .from("saved_stories")
    .select("story_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  const ids = (savedRows ?? []).map((row) => row.story_id);

  if (ids.length === 0) {
    return [];
  }

  const { data: stories } = await admin.from("stories").select("*").in("id", ids);
  const byId = new Map((stories ?? []).map((story) => [story.id, fromDatabaseStory(story as DatabaseStory)]));

  return ids.map((id) => byId.get(id)).filter((story): story is NewsStory => Boolean(story));
}

export async function saveUserSettings(admin: SupabaseClient, userId: string, settings: StoredState["settings"]) {
  await admin.from("user_settings").upsert({
    user_id: userId,
    theme: settings.theme,
    font_size: settings.fontSize,
    categories: settings.categories,
    notification_time: settings.notificationTime,
    updated_at: new Date().toISOString()
  });
}

export async function saveStoryRead(admin: SupabaseClient, userId: string, storyId: string) {
  await admin.from("read_stories").upsert({
    user_id: userId,
    story_id: storyId,
    read_at: new Date().toISOString()
  });
}

export async function setStorySaved(admin: SupabaseClient, userId: string, storyId: string, saved: boolean) {
  if (saved) {
    await admin.from("saved_stories").upsert({
      user_id: userId,
      story_id: storyId,
      created_at: new Date().toISOString()
    });
    return;
  }

  await admin.from("saved_stories").delete().eq("user_id", userId).eq("story_id", storyId);
}

export async function upsertStories(admin: SupabaseClient, stories: NewsStory[]) {
  if (stories.length === 0) {
    return;
  }

  await admin.from("stories").upsert(stories.map(toDatabaseStory), { onConflict: "id" });
}

export async function loadPersistedStories(admin: SupabaseClient): Promise<NewsStory[]> {
  const { data } = await admin.from("stories").select("*").order("published_at", { ascending: false });
  return (data ?? []).map(fromDatabaseStory);
}

export async function loadLatestStoryUpdate(admin: SupabaseClient): Promise<string | null> {
  const { data } = await admin
    .from("stories")
    .select("updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.updated_at ?? null;
}

function toDatabaseStory(story: NewsStory): DatabaseStory {
  return {
    id: story.id,
    category: story.category,
    headline: story.headline,
    summary: story.summary,
    source: story.source,
    source_url: story.url,
    published_at: story.timestamp,
    why_it_matters: story.whyItMatters,
    background: story.background ?? null
  };
}

function fromDatabaseStory(story: DatabaseStory): NewsStory {
  return {
    id: story.id,
    category: story.category,
    headline: story.headline,
    summary: story.summary,
    source: story.source,
    timestamp: story.published_at,
    url: story.source_url,
    whyItMatters: story.why_it_matters,
    background: story.background ?? undefined
  };
}

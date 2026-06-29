export type NewsCategory =
  | "top"
  | "world"
  | "politics"
  | "business"
  | "technology"
  | "science"
  | "health"
  | "sports";

export type NewsStory = {
  id: string;
  category: NewsCategory;
  headline: string;
  summary: string;
  source: string;
  timestamp: string;
  url: string;
  whyItMatters: string;
  background?: string;
};

export type MembershipTier = "free" | "paid";

export type DailyBrief = {
  generatedAt: string;
  readTimeMinutes: number;
  membershipTier?: MembershipTier;
  refreshIntervalMs?: number;
  totalAvailableStories?: number;
  stories: NewsStory[];
};

export type FeedConfig = {
  category: NewsCategory;
  source: string;
  url: string;
  homepageUrl: string;
  priority: number;
};

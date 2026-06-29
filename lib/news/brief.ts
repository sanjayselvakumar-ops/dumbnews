import Parser from "rss-parser";
import type { DailyBrief, FeedConfig, MembershipTier, NewsStory } from "./types";
import { FEEDS } from "./feeds";
import { fallbackBrief, FALLBACK_STORIES } from "./fallback";
import { refreshIntervalForTier, storyLimitForTier } from "@/lib/membership";
import {
  getSupabaseAdminClient,
  loadLatestStoryUpdate,
  loadPersistedStories,
  upsertStories
} from "@/lib/supabase/server";
import { fetchNewsApiStories, hasNewsApiKey, isFreeOutlet, NEWS_API_CACHE_MS } from "./news-api";
import { extractReadableText } from "./readability";
import {
  backgroundContext,
  estimateReadTime,
  makeId,
  normalizeTitle,
  resolveSourceUrl,
  summarizeStory,
  whyItMatters
} from "./text";

type CacheEntry = {
  expiresAt: number;
  brief: DailyBrief;
};

const parser = new Parser();
let cache: CacheEntry | null = null;
export const BRIEF_CACHE_MS = 1000 * 60 * 5;
export const MAX_ITEMS_PER_FEED = 20;
const SAMPLE_SOURCE = "Sample Brief";

type BriefOptions = {
  force?: boolean;
  membershipTier?: MembershipTier;
};

type FeedItem = Parser.Item & {
  isoDate?: string;
  pubDate?: string;
  contentSnippet?: string;
  content?: string;
};

function sentenceCount(value: string) {
  return value.split(/(?<=[.!?])\s+/).filter((sentence) => sentence.trim().length > 0).length;
}

function firstUsefulText(...values: Array<string | undefined>): string {
  return values.find((value) => {
    const clean = value?.trim();
    return clean && clean.toLowerCase() !== "null";
  }) ?? "";
}

function shouldSkipFeedItem(headline: string): boolean {
  return (
    /\blive\b|live$/i.test(headline) ||
    /\bminute-by-minute\b/i.test(headline) ||
    /\.{3}|…/.test(headline)
  );
}

async function fetchFeed(feed: FeedConfig): Promise<NewsStory[]> {
  try {
    const parsed = await parser.parseURL(feed.url);

    const stories = (parsed.items as FeedItem[])
      .slice(0, MAX_ITEMS_PER_FEED)
      .filter((item) => !shouldSkipFeedItem(item.title?.trim() || ""))
      .map(async (item) => {
      const headline = item.title?.trim() || "Untitled story";
      const url = resolveSourceUrl(item.link, feed.homepageUrl);
      const source = feed.source;
      const timestamp = new Date(item.isoDate || item.pubDate || Date.now()).toISOString();
      const feedText = firstUsefulText(item.contentSnippet, item.content, item.summary);
      const articleText = sentenceCount(feedText) < 3 && item.link ? await extractReadableText(url) : "";
      const sourceText = [feedText, articleText].filter(Boolean).join(" ") || headline;
      const summary = summarizeStory(sourceText, headline, feed.category);

      return {
        id: makeId(source, headline, url),
        category: feed.category,
        headline,
        summary,
        source,
        timestamp,
        url,
        whyItMatters: whyItMatters(feed.category),
        background: backgroundContext(headline, feed.category)
      };
    });

    return Promise.all(stories);
  } catch {
    return [];
  }
}

function dedupeStories(stories: NewsStory[]): NewsStory[] {
  const seen = new Set<string>();

  return stories.filter((story) => {
    const key = normalizeTitle(story.headline).slice(0, 80);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function rankStories(stories: NewsStory[]): NewsStory[] {
  const sorted = [...stories].sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
  const ranked: NewsStory[] = [];
  const selected = new Set<string>();
  const sourceCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();

  for (let limit = 1; ranked.length < sorted.length; limit += 1) {
    for (const story of sorted) {
      if (selected.has(story.id)) {
        continue;
      }

      const sourceCount = sourceCounts.get(story.source) ?? 0;
      const categoryCount = categoryCounts.get(story.category) ?? 0;
      if (sourceCount >= limit || categoryCount >= limit * 2) {
        continue;
      }

      selected.add(story.id);
      sourceCounts.set(story.source, sourceCount + 1);
      categoryCounts.set(story.category, categoryCount + 1);
      ranked.push(story);
    }
  }

  return ranked;
}

export async function getDailyBrief(options: BriefOptions | boolean = {}): Promise<DailyBrief> {
  const force = typeof options === "boolean" ? options : options.force ?? false;
  const membershipTier = typeof options === "boolean" ? "free" : options.membershipTier ?? "free";

  if (!force && cache && cache.expiresAt > Date.now()) {
    return applyTier(cache.brief, membershipTier);
  }

  const admin = getSupabaseAdminClient();
  const persistedStories = admin ? await loadPersistedStories(admin).catch(() => []) : [];
  const latestPersistedUpdate = admin ? await loadLatestStoryUpdate(admin).catch(() => null) : null;
  const hasFreshPersistedNews =
    Boolean(latestPersistedUpdate) &&
    Date.now() - new Date(latestPersistedUpdate as string).getTime() < NEWS_API_CACHE_MS &&
    persistedStories.length >= 10;
  const liveStories = hasFreshPersistedNews
    ? []
    : await fetchLiveStories();

  if (admin && liveStories.length > 0) {
    await upsertStories(admin, liveStories);
  }

  const nextPersistedStories = liveStories.length > 0 && admin ? await loadPersistedStories(admin).catch(() => persistedStories) : persistedStories;
  const productionPersistedStories = removeSampleStoriesWhenRealNewsExists(nextPersistedStories);
  const stories =
    productionPersistedStories.length > 0
      ? rankStories(dedupeStories([...liveStories, ...productionPersistedStories]))
      : liveStories.length >= 5
        ? liveStories
        : FALLBACK_STORIES;

  if (admin && liveStories.length === 0) {
    await upsertStories(admin, FALLBACK_STORIES);
  }
  const brief: DailyBrief = {
    generatedAt: new Date().toISOString(),
    readTimeMinutes: estimateReadTime(stories.length),
    membershipTier: "paid",
    refreshIntervalMs: refreshIntervalForTier("paid"),
    stories
  };

  cache = {
    expiresAt: Date.now() + BRIEF_CACHE_MS,
    brief
  };

  return applyTier(brief, membershipTier);
}

export async function searchStories(query: string, membershipTier: MembershipTier = "free"): Promise<NewsStory[]> {
  const brief = await getDailyBrief({ membershipTier });
  const needle = query.trim().toLowerCase();

  if (!needle) {
    return [];
  }

  return brief.stories.filter((story) => {
    return [story.headline, story.summary]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
}

export function getFallbackBrief(): DailyBrief {
  return fallbackBrief();
}

export function resetBriefCacheForTests() {
  cache = null;
}

export { dedupeStories, rankStories };

export function applyTier(brief: DailyBrief, membershipTier: MembershipTier): DailyBrief {
  const limit = storyLimitForTier(membershipTier);
  const tierStories =
    membershipTier === "free"
      ? preferFreeOutletStories(brief.stories)
      : brief.stories;
  const stories = limit === null ? tierStories : tierStories.slice(0, limit);

  return {
    ...brief,
    membershipTier,
    refreshIntervalMs: refreshIntervalForTier(membershipTier),
    readTimeMinutes: estimateReadTime(stories.length),
    stories
  };
}

async function fetchLiveStories(): Promise<NewsStory[]> {
  if (hasNewsApiKey()) {
    const newsApiStories = rankStories(dedupeStories(await fetchNewsApiStories()));
    if (newsApiStories.length >= 10) {
      return newsApiStories;
    }
  }

  const settled = await Promise.all(FEEDS.map(fetchFeed));
  return rankStories(dedupeStories(settled.flat()));
}

function preferFreeOutletStories(stories: NewsStory[]): NewsStory[] {
  const freeOutletStories = stories.filter((story) => isFreeOutlet(story.source));

  if (freeOutletStories.length >= 10) {
    return freeOutletStories;
  }

  return stories;
}

function removeSampleStoriesWhenRealNewsExists(stories: NewsStory[]): NewsStory[] {
  const realStories = stories.filter((story) => story.source !== SAMPLE_SOURCE);

  return realStories.length >= 10 ? realStories : stories;
}

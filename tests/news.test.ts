import { describe, expect, it } from "vitest";
import type { NewsStory } from "@/lib/news/types";
import { FREE_REFRESH_MS, FREE_STORY_LIMIT, PAID_REFRESH_MS } from "@/lib/membership";
import { BRIEF_CACHE_MS, applyTier, dedupeStories, rankStories } from "@/lib/news/brief";
import {
  backgroundContext,
  estimateReadTime,
  resolveSourceUrl,
  summarize,
  summarizeStory
} from "@/lib/news/text";

const baseStory: NewsStory = {
  id: "a",
  category: "world",
  headline: "Leaders meet for summit",
  summary: "Leaders met.",
  source: "Test",
  timestamp: "2026-06-26T12:00:00.000Z",
  url: "https://example.com/a",
  whyItMatters: "It matters."
};

describe("news helpers", () => {
  it("summarizes to three to five sentences when enough text exists", () => {
    expect(summarize("One matters today. Two adds new facts. Three explains impact. Four gives context. Five closes the loop. Six is extra.", "Fallback")).toBe(
      "One matters today. Two adds new facts. Three explains impact. Four gives context. Five closes the loop."
    );
  });

  it("avoids empty and repeated summary sentences", () => {
    expect(summarize("One useful sentence appears here. One useful sentence appears here. Two useful sentence appears here.", "Fallback")).toBe(
      "One useful sentence appears here. Two useful sentence appears here."
    );
  });

  it("pads thin story summaries to at least three sentences", () => {
    const summary = summarizeStory("England topped the group.", "England top their World Cup group", "sports");
    expect((summary.match(/[.!?](\s|$)/g) || []).length).toBeGreaterThanOrEqual(3);
  });

  it("falls back from invalid source URLs to a homepage", () => {
    expect(resolveSourceUrl("https://example.com/story", "https://example.com")).toBe("https://example.com/story");
    expect(resolveSourceUrl("not a url", "https://example.com")).toBe("https://example.com");
  });

  it("generates relevant non-boilerplate background context", () => {
    const background = backgroundContext("England top their World Cup group", "sports");
    expect(background).toContain("Background:");
    expect(background).toContain("Current story:");
    expect(background).not.toContain("public RSS feed");
  });

  it("dedupes by normalized headline", () => {
    const stories = dedupeStories([
      baseStory,
      { ...baseStory, id: "b", headline: "Leaders meet for summit!" }
    ]);

    expect(stories).toHaveLength(1);
  });

  it("ranks newest stories first by timestamp", () => {
    const stories = rankStories([
      { ...baseStory, id: "old", category: "world", timestamp: "2026-06-26T12:00:00.000Z" },
      { ...baseStory, id: "new", category: "sports", timestamp: "2026-06-26T17:30:00.000Z" },
      { ...baseStory, id: "middle", category: "politics", timestamp: "2026-06-26T16:30:00.000Z" }
    ]);

    expect(stories.map((story) => story.id)).toEqual(["new", "middle", "old"]);
  });

  it("balances sources so one feed does not dominate the top stories", () => {
    const stories = rankStories([
      { ...baseStory, id: "espn-1", source: "ESPN", category: "sports", timestamp: "2026-06-26T17:30:00.000Z" },
      { ...baseStory, id: "espn-2", source: "ESPN", category: "sports", timestamp: "2026-06-26T17:29:00.000Z" },
      { ...baseStory, id: "espn-3", source: "ESPN", category: "sports", timestamp: "2026-06-26T17:28:00.000Z" },
      { ...baseStory, id: "npr-1", source: "NPR", category: "politics", timestamp: "2026-06-26T17:10:00.000Z" },
      { ...baseStory, id: "bbc-1", source: "BBC", category: "world", timestamp: "2026-06-26T17:00:00.000Z" }
    ]);

    expect(stories.slice(0, 3).map((story) => story.source)).toEqual(["ESPN", "NPR", "BBC"]);
  });

  it("drops literal null feed snippets from summaries", () => {
    const summary = summarizeStory("null", "NASA announces new mission", "science");
    expect(summary.toLowerCase()).not.toContain("null");
  });

  it("caps read time within the app goal", () => {
    expect(estimateReadTime(20)).toBeLessThanOrEqual(5);
  });

  it("uses a five-minute brief cache for live refresh", () => {
    expect(BRIEF_CACHE_MS).toBe(1000 * 60 * 5);
  });

  it("limits free users to the latest ten stories", () => {
    const stories = Array.from({ length: 12 }, (_, index) => ({
      ...baseStory,
      id: String(index),
      timestamp: new Date(Date.UTC(2026, 5, 26, index)).toISOString()
    }));
    const brief = applyTier({ generatedAt: baseStory.timestamp, readTimeMinutes: 5, stories }, "free");

    expect(brief.stories).toHaveLength(FREE_STORY_LIMIT);
    expect(brief.membershipTier).toBe("free");
    expect(brief.refreshIntervalMs).toBe(FREE_REFRESH_MS);
  });

  it("returns all stories for paid users with faster refresh", () => {
    const stories = Array.from({ length: 12 }, (_, index) => ({ ...baseStory, id: String(index) }));
    const brief = applyTier({ generatedAt: baseStory.timestamp, readTimeMinutes: 5, stories }, "paid");

    expect(brief.stories).toHaveLength(12);
    expect(brief.membershipTier).toBe("paid");
    expect(brief.refreshIntervalMs).toBe(PAID_REFRESH_MS);
  });

  it("keeps a realtime paid count equal to all accumulated stories", () => {
    const stories = Array.from({ length: 48 }, (_, index) => ({ ...baseStory, id: String(index) }));
    const freeBrief = applyTier({ generatedAt: baseStory.timestamp, readTimeMinutes: 5, stories }, "free");
    const paidBrief = applyTier({ generatedAt: baseStory.timestamp, readTimeMinutes: 5, stories }, "paid");

    expect(freeBrief.stories).toHaveLength(10);
    expect(paidBrief.stories).toHaveLength(48);
  });
});

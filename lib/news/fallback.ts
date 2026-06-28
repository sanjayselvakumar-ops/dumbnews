import type { DailyBrief, NewsStory } from "./types";
import { backgroundContext, estimateReadTime } from "./text";

const now = new Date().toISOString();

export const FALLBACK_STORIES: NewsStory[] = [
  {
    id: "fallback-politics",
    category: "politics",
    headline: "Lawmakers moved a short-term funding bill forward.",
    summary:
      "Congress advanced a temporary spending bill designed to keep federal agencies open while budget talks continue.",
    source: "Sample Brief",
    timestamp: now,
    url: "https://www.reuters.com/world/us/",
    whyItMatters:
      "Political decisions can change public services, laws, budgets, and the direction of government.",
    background: "This fallback appears only when live feeds cannot be reached."
  },
  {
    id: "fallback-science",
    category: "science",
    headline: "Researchers reported progress on cleaner battery materials.",
    summary:
      "A new study described a lower-cost battery chemistry that could reduce reliance on scarce materials if it scales.",
    source: "Sample Brief",
    timestamp: now,
    url: "https://www.bbc.com/news/science_and_environment",
    whyItMatters:
      "Scientific developments can change what we know about the world and what becomes possible next.",
    background: "This fallback appears only when live feeds cannot be reached."
  },
  {
    id: "fallback-business",
    category: "business",
    headline: "Markets watched inflation data for signs of rate cuts.",
    summary:
      "Investors looked to new inflation figures for clues about whether central banks may begin easing interest rates.",
    source: "Sample Brief",
    timestamp: now,
    url: "https://www.bbc.com/news/business",
    whyItMatters: "Business shifts can affect prices, jobs, investment, and the wider economy.",
    background: "This fallback appears only when live feeds cannot be reached."
  },
  {
    id: "fallback-sports",
    category: "sports",
    headline: "A championship race tightened after a late comeback.",
    summary:
      "A leading contender won after trailing early, keeping the title race close heading into the final stretch.",
    source: "Sample Brief",
    timestamp: now,
    url: "https://www.bbc.com/sport",
    whyItMatters: "Major sports results shape leagues, fan communities, and cultural moments.",
    background: "This fallback appears only when live feeds cannot be reached."
  },
  {
    id: "fallback-world",
    category: "world",
    headline: "World leaders prepared for another round of talks.",
    summary:
      "Diplomats scheduled new meetings aimed at reducing tensions and coordinating economic measures.",
    source: "Sample Brief",
    timestamp: now,
    url: "https://www.bbc.com/news/world",
    whyItMatters:
      "International events can affect security, diplomacy, markets, and daily life far beyond one country.",
    background: "This fallback appears only when live feeds cannot be reached."
  }
];

for (const story of FALLBACK_STORIES) {
  story.background = backgroundContext(story.headline, story.category);
}

export function fallbackBrief(): DailyBrief {
  return {
    generatedAt: now,
    readTimeMinutes: estimateReadTime(FALLBACK_STORIES.length),
    stories: FALLBACK_STORIES
  };
}

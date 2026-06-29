import type { NewsCategory, NewsStory } from "./types";
import {
  backgroundContext,
  makeId,
  resolveSourceUrl,
  summarizeStory,
  whyItMatters
} from "./text";

type NewsApiArticle = {
  source?: {
    id?: string | null;
    name?: string | null;
  };
  author?: string | null;
  title?: string | null;
  description?: string | null;
  url?: string | null;
  urlToImage?: string | null;
  publishedAt?: string | null;
  content?: string | null;
};

type NewsApiResponse = {
  status: string;
  totalResults?: number;
  articles?: NewsApiArticle[];
  code?: string;
  message?: string;
};

const NEWS_API_URL = "https://newsapi.org/v2/everything";

export const NEWS_API_CACHE_MS = 1000 * 60 * 60;

const NEWS_API_DOMAINS = [
  "bbc.co.uk",
  "bbc.com",
  "npr.org",
  "theguardian.com",
  "techcrunch.com",
  "theverge.com",
  "arstechnica.com",
  "espn.com",
  "nasa.gov",
  "sciencedaily.com",
  "apnews.com",
  "reuters.com"
];

export const FREE_OUTLET_NAMES = ["BBC", "NPR", "The Guardian", "Associated Press", "Reuters"];

const SOURCE_NORMALIZATIONS: Array<[RegExp, string]> = [
  [/bbc/i, "BBC"],
  [/npr/i, "NPR"],
  [/guardian/i, "The Guardian"],
  [/techcrunch/i, "TechCrunch"],
  [/verge/i, "The Verge"],
  [/ars/i, "Ars Technica"],
  [/espn/i, "ESPN"],
  [/nasa/i, "NASA"],
  [/sciencedaily|science daily/i, "ScienceDaily"],
  [/associated press|ap news|apnews/i, "Associated Press"],
  [/reuters/i, "Reuters"]
];

const CATEGORY_RULES: Array<[NewsCategory, RegExp]> = [
  ["business", /\b(business|market|markets|stock|stocks|inflation|economy|economic|company|earnings|jobs|tariff|trade)\b/i],
  ["technology", /\b(technology|tech|ai|software|cyber|security|hack|data|startup|app|chip|chips|platform)\b/i],
  ["science", /\b(science|space|nasa|research|study|climate|weather|planet|mission|scientist)\b/i],
  ["health", /\b(health|medical|medicine|disease|hospital|doctor|vaccine|covid|drug|treatment)\b/i],
  ["sports", /\b(sport|sports|nba|nfl|mlb|soccer|world cup|tennis|golf|coach|team|game)\b/i],
  ["politics", /\b(politics|election|congress|senate|house|president|trump|biden|court|lawmakers|government|policy)\b/i],
  ["world", /\b(world|war|ukraine|russia|china|iran|israel|europe|africa|asia|global|international)\b/i]
];

export function hasNewsApiKey(): boolean {
  return Boolean(process.env.NEWS_API_KEY);
}

export function isFreeOutlet(source: string): boolean {
  return FREE_OUTLET_NAMES.some((name) => source.toLowerCase().includes(name.toLowerCase()));
}

export async function fetchNewsApiStories(): Promise<NewsStory[]> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) {
    return [];
  }

  const url = new URL(NEWS_API_URL);
  url.searchParams.set("domains", NEWS_API_DOMAINS.join(","));
  url.searchParams.set("language", "en");
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("pageSize", "100");

  const response = await fetch(url, {
    headers: {
      "X-Api-Key": apiKey
    },
    next: {
      revalidate: Math.floor(NEWS_API_CACHE_MS / 1000)
    }
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as NewsApiResponse;
  if (data.status !== "ok" || !data.articles) {
    return [];
  }

  return data.articles
    .map(toStory)
    .filter((story): story is NewsStory => Boolean(story));
}

function toStory(article: NewsApiArticle): NewsStory | null {
  const headline = article.title?.trim();
  const publishedAt = article.publishedAt ? new Date(article.publishedAt) : null;

  if (!headline || !article.url || !publishedAt || Number.isNaN(publishedAt.getTime())) {
    return null;
  }

  if (/\[removed\]/i.test(headline) || /\.{3}|…/.test(headline)) {
    return null;
  }

  const source = normalizeSource(article.source?.name, article.url);
  const url = resolveSourceUrl(article.url, homepageForSource(source));
  const category = classifyCategory(`${headline} ${article.description ?? ""} ${article.content ?? ""}`, source);
  const sourceText = [article.description, article.content].filter(Boolean).join(" ") || headline;

  return {
    id: makeId(source, headline, url),
    category,
    headline,
    summary: summarizeStory(sourceText, headline, category),
    source,
    timestamp: publishedAt.toISOString(),
    url,
    whyItMatters: whyItMatters(category),
    background: backgroundContext(headline, category)
  };
}

function normalizeSource(sourceName: string | null | undefined, articleUrl: string): string {
  const value = sourceName || articleUrl;
  const match = SOURCE_NORMALIZATIONS.find(([pattern]) => pattern.test(value));
  return match?.[1] ?? sourceName ?? new URL(articleUrl).hostname.replace(/^www\./, "");
}

function homepageForSource(source: string): string {
  const copy: Record<string, string> = {
    BBC: "https://www.bbc.com/news",
    NPR: "https://www.npr.org",
    "The Guardian": "https://www.theguardian.com",
    TechCrunch: "https://techcrunch.com",
    "The Verge": "https://www.theverge.com",
    "Ars Technica": "https://arstechnica.com",
    ESPN: "https://www.espn.com",
    NASA: "https://www.nasa.gov/news",
    ScienceDaily: "https://www.sciencedaily.com/news",
    "Associated Press": "https://apnews.com",
    Reuters: "https://www.reuters.com"
  };

  return copy[source] ?? "https://newsapi.org";
}

function classifyCategory(value: string, source: string): NewsCategory {
  if (source === "ESPN") {
    return "sports";
  }

  if (source === "TechCrunch" || source === "The Verge" || source === "Ars Technica") {
    return "technology";
  }

  if (source === "NASA" || source === "ScienceDaily") {
    return "science";
  }

  return CATEGORY_RULES.find(([, pattern]) => pattern.test(value))?.[0] ?? "world";
}

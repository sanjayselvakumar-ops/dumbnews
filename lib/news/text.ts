import type { NewsCategory } from "./types";

const SENTENCE_BOUNDARY = /(?<=[.!?])\s+/;
const TAGS = /<[^>]*>/g;
const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&quot;": "\"",
  "&#39;": "'",
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": " "
};

export function stripHtml(value: string | undefined): string {
  if (!value) {
    return "";
  }

  const clean = value
    .replace(TAGS, " ")
    .replace(/&(?:amp|quot|#39|apos|lt|gt|nbsp);/g, (match) => ENTITIES[match] ?? match)
    .replace(/\s+/g, " ")
    .trim();

  return clean.toLowerCase() === "null" ? "" : clean;
}

const WEAK_SENTENCE_PATTERNS = [
  /^sign up\b/i,
  /^follow\b/i,
  /^watch\b/i,
  /^listen\b/i,
  /^read more\b/i,
  /^continue reading\b/i,
  /^espn news services\b/i,
  /^and then there were\b/i,
  /^this video\b/i,
  /figure caption/i,
  /^image source\b/i,
  /^copyright\b/i,
  /\bmail [a-z]+$/i,
  /\bplayer guide\b/i,
  /\bbracketology\b/i
];

function cleanSentence(sentence: string): string {
  return sentence
    .replace(/\bU\.\s*S\./g, "U.S.")
    .replace(/\bU\.\s*K\./g, "U.K.")
    .replace(/\bE\.\s*U\./g, "E.U.")
    .replace(/\s*Continue reading\.\.\..*$/i, "")
    .replace(/([.!?])(?=[A-Z])/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sourceTextForSummary(value: string, headline: string): string {
  return stripHtml(value)
    .replace(/\s*Continue reading\.\.\..*$/i, "")
    .replace(/\s*-\s*Odds to win\b.*$/i, "")
    .replace(/\s*-\s*Grades for every team\b.*$/i, "")
    .replace(/[⚽️•]/g, ". ")
    .replace(/\s+[–—]\s+/g, ". ")
    .replace(new RegExp(escapeRegExp(headline), "gi"), " ")
    .replace(/\.{3}/g, " ")
    .replace(/([a-z0-9])([A-Z][a-z])/g, "$1. $2")
    .replace(/\s+/g, " ")
    .trim();
}

function isWeakSentence(sentence: string): boolean {
  const words = sentence.split(/\s+/).filter(Boolean).length;
  return (
    sentence.length < 18 ||
    words < 3 ||
    words > 55 ||
    WEAK_SENTENCE_PATTERNS.some((pattern) => pattern.test(sentence))
  );
}

function usefulSentences(value: string, fallback: string): string[] {
  const clean = stripHtml(value) || fallback;
  const seen = new Set<string>();

  return clean
    .split(SENTENCE_BOUNDARY)
    .map(cleanSentence)
    .filter((sentence) => {
      if (isWeakSentence(sentence)) {
        return false;
      }

      const key = normalizeTitle(sentence).slice(0, 90);
      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

export function summarize(value: string, fallback: string): string {
  const clean = sourceTextForSummary(value, fallback) || fallback;
  const rawSentences = clean.split(SENTENCE_BOUNDARY).map(cleanSentence).filter(Boolean);
  const candidates = usefulSentences(clean, fallback);
  const sentences = (candidates.length > 0 ? candidates : rawSentences).slice(0, 5);
  const summary = sentences.join(" ").trim();

  if (summary.length <= 760) {
    return summary;
  }

  return `${summary.slice(0, 757).trim()}...`;
}

function ensurePeriod(value: string): string {
  const clean = value.trim();
  if (/[.!?]$/.test(clean)) {
    return clean;
  }

  return `${clean}.`;
}

function displaySentenceCount(value: string): number {
  return value.replace(/\.{3}/g, "").match(/[.!?]["'”’)]?(\s|$)/g)?.length ?? 0;
}

function followUpSentence(category: NewsCategory): string {
  const copy: Record<NewsCategory, string> = {
    top: "The next thing to watch is whether officials, companies, or affected groups confirm new details.",
    world: "The next thing to watch is how governments, communities, or international groups respond.",
    politics: "The next thing to watch is whether lawmakers, courts, or public agencies take follow-up action.",
    business: "The next thing to watch is whether markets, companies, workers, or consumers feel a wider effect.",
    technology: "The next thing to watch is whether users, companies, or regulators respond to the development.",
    science: "The next thing to watch is whether researchers can confirm, repeat, or build on the finding.",
    health: "The next thing to watch is whether doctors, officials, or affected communities change their guidance.",
    sports: "The next thing to watch is how the result affects the team, player, schedule, or competition."
  };

  return copy[category];
}

function categoryContextSentence(category: NewsCategory): string {
  const copy: Record<NewsCategory, string> = {
    top: "This story is included because it is one of the notable updates in the current news cycle.",
    world: "The story matters in the wider world context because it may affect diplomacy, security, or people in the region.",
    politics: "The story sits in a political context because it involves public power, policy, budgets, elections, or government decisions.",
    business: "The story sits in a business context because it may affect prices, jobs, companies, investors, or the wider economy.",
    technology: "The story sits in a technology context because it may affect products, platforms, privacy, security, or how people work.",
    science: "The story sits in a science context because it adds to what researchers, agencies, or the public know about the issue.",
    health: "The story sits in a health context because it may affect medical decisions, public guidance, risk, or access to care.",
    sports: "The story sits in a sports context because it affects a result, team, athlete, competition, or fan conversation."
  };

  return copy[category];
}

export function summarizeStory(value: string, headline: string, category: NewsCategory): string {
  const summary = summarize(value, headline);
  const sentences = summary.split(SENTENCE_BOUNDARY).map(cleanSentence).filter(Boolean);
  const seen = new Set(sentences.map((sentence) => normalizeTitle(sentence).slice(0, 90)));
  const additions = [
    ensurePeriod(`The main update is ${headline}`),
    categoryContextSentence(category),
    followUpSentence(category)
  ];

  for (const sentence of additions) {
    if (sentences.length >= 3) {
      break;
    }

    const key = normalizeTitle(sentence).slice(0, 90);
    if (!seen.has(key)) {
      sentences.push(sentence);
      seen.add(key);
    }
  }

  const finalSentences = sentences.slice(0, 5);
  for (const sentence of additions) {
    if (displaySentenceCount(finalSentences.join(" ")) >= 3 || finalSentences.length >= 5) {
      break;
    }

    const key = normalizeTitle(sentence).slice(0, 90);
    if (!seen.has(key)) {
      finalSentences.push(sentence);
      seen.add(key);
    }
  }

  return finalSentences.join(" ");
}

export function normalizeTitle(value: string): string {
  return stripHtml(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function makeId(source: string, title: string, url: string): string {
  const input = `${source}:${normalizeTitle(title)}:${url}`;
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}

export function resolveSourceUrl(articleUrl: string | undefined, sourceHomepage: string): string {
  if (!articleUrl) {
    return sourceHomepage;
  }

  try {
    const parsed = new URL(articleUrl);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    return sourceHomepage;
  }

  return sourceHomepage;
}

export function backgroundContext(headline: string, category: NewsCategory): string {
  const cleanHeadline = ensurePeriod(headline);
  const copy: Record<NewsCategory, string> = {
    top: "Background: Major news stories usually connect to earlier decisions, recent events, or pressure that has been building over time.",
    world: "Background: World stories often involve history between governments, regional tensions, international agreements, or communities affected by earlier events.",
    politics: "Background: Political stories usually sit inside longer fights over laws, budgets, elections, public services, or the power of government institutions.",
    business: "Background: Business stories often connect to broader trends in prices, jobs, company strategy, consumer demand, markets, or interest rates.",
    technology: "Background: Technology stories often build on earlier product launches, security problems, regulatory pressure, or changes in how people use digital tools.",
    science: "Background: Science stories usually build on earlier research, experiments, missions, measurements, or debates about what the evidence shows.",
    health: "Background: Health stories often connect to earlier studies, public guidance, treatment access, risk levels, or decisions by medical and government officials.",
    sports: "Background: Sports stories usually depend on recent form, previous results, injuries, coaching decisions, standings, or tournament history."
  };

  return `${copy[category]} Current story: ${cleanHeadline}`;
}

export function whyItMatters(category: NewsCategory): string {
  const copy: Record<NewsCategory, string> = {
    top: "This story is one of the main events shaping today's public conversation.",
    world: "International events can affect security, diplomacy, markets, and daily life far beyond one country.",
    politics: "Political decisions can change public services, laws, budgets, and the direction of government.",
    business: "Business shifts can affect prices, jobs, investment, and the wider economy.",
    technology: "Technology changes can quickly reshape work, privacy, culture, and how people communicate.",
    science: "Scientific developments can change what we know about the world and what becomes possible next.",
    health: "Health news can affect public guidance, medical decisions, and everyday risk.",
    sports: "Major sports results shape leagues, fan communities, and cultural moments."
  };

  return copy[category];
}

export function estimateReadTime(storyCount: number): number {
  return Math.max(1, Math.min(5, Math.ceil((storyCount * 35) / 220)));
}

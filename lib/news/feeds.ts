import type { FeedConfig } from "./types";

export const FEEDS: FeedConfig[] = [
  {
    category: "world",
    source: "BBC",
    homepageUrl: "https://www.bbc.com/news/world",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    priority: 10
  },
  {
    category: "world",
    source: "NPR",
    homepageUrl: "https://www.npr.org/sections/world/",
    url: "https://feeds.npr.org/1004/rss.xml",
    priority: 10
  },
  {
    category: "world",
    source: "The Guardian",
    homepageUrl: "https://www.theguardian.com/world",
    url: "https://www.theguardian.com/world/rss",
    priority: 9
  },
  {
    category: "politics",
    source: "BBC",
    homepageUrl: "https://www.bbc.com/news/politics",
    url: "https://feeds.bbci.co.uk/news/politics/rss.xml",
    priority: 9
  },
  {
    category: "politics",
    source: "NPR",
    homepageUrl: "https://www.npr.org/sections/politics/",
    url: "https://feeds.npr.org/1014/rss.xml",
    priority: 9
  },
  {
    category: "politics",
    source: "The Guardian",
    homepageUrl: "https://www.theguardian.com/us-news/us-politics",
    url: "https://www.theguardian.com/us-news/us-politics/rss",
    priority: 8
  },
  {
    category: "business",
    source: "BBC",
    homepageUrl: "https://www.bbc.com/news/business",
    url: "https://feeds.bbci.co.uk/news/business/rss.xml",
    priority: 8
  },
  {
    category: "business",
    source: "NPR",
    homepageUrl: "https://www.npr.org/sections/business/",
    url: "https://feeds.npr.org/1006/rss.xml",
    priority: 8
  },
  {
    category: "business",
    source: "The Guardian",
    homepageUrl: "https://www.theguardian.com/business",
    url: "https://www.theguardian.com/business/rss",
    priority: 8
  },
  {
    category: "technology",
    source: "BBC",
    homepageUrl: "https://www.bbc.com/news/technology",
    url: "https://feeds.bbci.co.uk/news/technology/rss.xml",
    priority: 8
  },
  {
    category: "technology",
    source: "TechCrunch",
    homepageUrl: "https://techcrunch.com",
    url: "https://techcrunch.com/feed/",
    priority: 9
  },
  {
    category: "technology",
    source: "The Verge",
    homepageUrl: "https://www.theverge.com",
    url: "https://www.theverge.com/rss/index.xml",
    priority: 8
  },
  {
    category: "technology",
    source: "Ars Technica",
    homepageUrl: "https://arstechnica.com",
    url: "https://feeds.arstechnica.com/arstechnica/index",
    priority: 8
  },
  {
    category: "science",
    source: "BBC",
    homepageUrl: "https://www.bbc.com/news/science_and_environment",
    url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
    priority: 7
  },
  {
    category: "science",
    source: "NASA",
    homepageUrl: "https://www.nasa.gov/news/",
    url: "https://www.nasa.gov/rss/dyn/breaking_news.rss",
    priority: 8
  },
  {
    category: "science",
    source: "ScienceDaily",
    homepageUrl: "https://www.sciencedaily.com/news/",
    url: "https://www.sciencedaily.com/rss/top.xml",
    priority: 7
  },
  {
    category: "science",
    source: "The Guardian",
    homepageUrl: "https://www.theguardian.com/science",
    url: "https://www.theguardian.com/science/rss",
    priority: 7
  },
  {
    category: "health",
    source: "BBC",
    homepageUrl: "https://www.bbc.com/news/health",
    url: "https://feeds.bbci.co.uk/news/health/rss.xml",
    priority: 7
  },
  {
    category: "health",
    source: "NPR",
    homepageUrl: "https://www.npr.org/sections/health/",
    url: "https://feeds.npr.org/1128/rss.xml",
    priority: 8
  },
  {
    category: "health",
    source: "ScienceDaily",
    homepageUrl: "https://www.sciencedaily.com/news/health_medicine/",
    url: "https://www.sciencedaily.com/rss/health_medicine.xml",
    priority: 7
  },
  {
    category: "health",
    source: "The Guardian",
    homepageUrl: "https://www.theguardian.com/society/health",
    url: "https://www.theguardian.com/society/health/rss",
    priority: 7
  },
  {
    category: "sports",
    source: "BBC Sport",
    homepageUrl: "https://www.bbc.com/sport",
    url: "https://feeds.bbci.co.uk/sport/rss.xml",
    priority: 6
  },
  {
    category: "sports",
    source: "ESPN",
    homepageUrl: "https://www.espn.com",
    url: "https://www.espn.com/espn/rss/news",
    priority: 7
  },
  {
    category: "sports",
    source: "The Guardian",
    homepageUrl: "https://www.theguardian.com/sport",
    url: "https://www.theguardian.com/sport/rss",
    priority: 6
  }
];

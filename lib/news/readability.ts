import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { stripHtml } from "./text";

export async function extractReadableText(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "DumbNewsPrototype/0.1"
      },
      signal: AbortSignal.timeout(2500)
    });

    if (!response.ok) {
      return "";
    }

    const html = await response.text();
    const dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document).parse();

    return stripHtml(article?.textContent ?? article?.excerpt ?? "");
  } catch {
    return "";
  }
}

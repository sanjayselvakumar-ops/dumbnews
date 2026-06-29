import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { DumbNewsApp } from "@/components/dumb-news-app";
import type { DailyBrief } from "@/lib/news/types";

const story = {
  id: "rocket",
  category: "science",
  headline: "SpaceX rocket launches successfully",
  summary:
    "SpaceX launched a rocket from Texas. Starship completed a major test flight. Engineers will use the results to improve future missions.",
  source: "Test Source",
  timestamp: "2026-06-26T12:00:00.000Z",
  url: "https://example.com/rocket",
  whyItMatters: "Rocket tests can improve future space travel."
} as const;

const brief: DailyBrief = {
  generatedAt: "2026-06-26T12:00:00.000Z",
  readTimeMinutes: 1,
  stories: [story]
};

describe("DumbNewsApp", () => {
  it("shows a login screen for logged-out users", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    await act(async () => {
      render(<DumbNewsApp initialBrief={brief} />);
    });

    expect(screen.getAllByText("LOG IN LOCAL").length).toBeGreaterThan(0);
    expect(screen.getAllByText("LOCAL DEMO MODE. ADD SUPABASE ENV VARS FOR REAL ACCOUNTS.").length).toBeGreaterThan(0);
  });

  it("continues into the app with local demo auth when Supabase is missing", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    await act(async () => {
      render(<DumbNewsApp initialBrief={brief} />);
    });

    fireEvent.click(screen.getByRole("button", { name: "LOG IN LOCAL" }));

    expect(screen.getAllByText("SpaceX rocket launches successfully").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 NEWS").length).toBeGreaterThan(0);
  });

  it("renders category icons on the home list", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    await act(async () => {
      render(<DumbNewsApp bypassAuthForTests initialBrief={brief} />);
    });

    expect(document.querySelector(".categoryIcon")).not.toBeNull();
    expect(screen.getAllByText("SpaceX rocket launches successfully").length).toBeGreaterThan(0);
  });

  it("renders the category icon on the detail screen", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    await act(async () => {
      render(<DumbNewsApp bypassAuthForTests initialBrief={brief} />);
    });

    const mobileStoryRow = document.querySelector(".mobileApp .storyRow");
    expect(mobileStoryRow).not.toBeNull();
    fireEvent.click(mobileStoryRow as Element);

    expect(document.querySelector(".heroIcon")).not.toBeNull();
    expect(screen.getAllByText("SUMMARY").length).toBeGreaterThan(0);
    expect(screen.getAllByText("WHY IT MATTERS").length).toBeGreaterThan(0);
  });

  it("renders detail summaries as plain text without term links", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    await act(async () => {
      render(<DumbNewsApp bypassAuthForTests initialBrief={brief} />);
    });

    const mobileStoryRow = document.querySelector(".mobileApp .storyRow");
    fireEvent.click(mobileStoryRow as Element);

    expect(screen.getAllByText(story.summary).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "SpaceX" })).toBeNull();
    expect(screen.queryByText("DEFINITION")).toBeNull();
  });

  it("stages refreshed stories behind a new stories prompt", async () => {
    vi.useFakeTimers();
    const nextBrief: DailyBrief = {
      ...brief,
      generatedAt: "2026-06-26T12:05:00.000Z",
      readTimeMinutes: 1,
      stories: [
        story,
        {
          ...story,
          id: "bill",
          category: "politics",
          headline: "Senate passes a temporary spending bill",
          summary: "The Senate passed a bill to keep agencies open.",
          url: "https://example.com/bill"
        }
      ]
    };

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => nextBrief })
    );

    await act(async () => {
      render(<DumbNewsApp bypassAuthForTests initialBrief={brief} />);
    });

    expect(fetch).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1000 * 60 * 10);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("1 NEW STORIES").length).toBeGreaterThan(0);
    expect(screen.queryByText("Senate passes a temporary spending bill")).toBeNull();

    fireEvent.click(screen.getAllByText("1 NEW STORIES")[0]);

    expect(screen.getAllByText("Senate passes a temporary spending bill").length).toBeGreaterThan(0);
    vi.useRealTimers();
  });
});

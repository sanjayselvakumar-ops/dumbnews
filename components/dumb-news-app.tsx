"use client";

import React from "react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Session } from "@supabase/supabase-js";
import type { AccountProfile } from "@/lib/membership";
import type { DailyBrief, NewsCategory, NewsStory } from "@/lib/news/types";
import { defaultStoredState, loadStoredState, saveStoredState, type StoredState } from "@/lib/app-storage";
import { monthDay, shortTime, todayKey } from "@/lib/date";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { BillingPrice } from "@/components/membership-selector";
import {
  BookmarkIcon,
  CategoryIcon,
  NewsIcon,
  PersonIcon,
  SearchIcon,
  SettingsIcon,
} from "@/components/icons";

type Screen = "home" | "detail" | "saved" | "search" | "settings" | "membership" | "complete";

type DumbNewsAppProps = {
  initialBrief: DailyBrief;
  bypassAuthForTests?: boolean;
};

const CATEGORIES: NewsCategory[] = [
  "top",
  "world",
  "politics",
  "business",
  "technology",
  "science",
  "health",
  "sports"
];
const FALLBACK_POLL_MS = 1000 * 60 * 10;

function updatedStatus(lastUpdated: string, isRefreshing: boolean, refreshError: boolean) {
  if (refreshError) {
    return "UPDATE FAILED";
  }

  if (isRefreshing) {
    return "UPDATING...";
  }

  return `UPDATED ${new Date(lastUpdated).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

function authenticatedFetch(url: string, token: string, init: RequestInit = {}) {
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`
    }
  });
}

export function DumbNewsApp({ initialBrief, bypassAuthForTests = false }: DumbNewsAppProps) {
  const [brief, setBrief] = useState(initialBrief);
  const [state, setState] = useState<StoredState>(defaultStoredState);
  const [session, setSession] = useState<Session | null>(null);
  const [localDemoAccount, setLocalDemoAccount] = useState<AccountProfile | null>(null);
  const [authReady, setAuthReady] = useState(bypassAuthForTests);
  const [accountReady, setAccountReady] = useState(bypassAuthForTests);
  const [authError, setAuthError] = useState<string | null>(null);
  const [profile, setProfile] = useState<AccountProfile | null>(
    bypassAuthForTests ? { email: "test@example.com", membershipTier: initialBrief.membershipTier ?? "free" } : null
  );
  const [accountSavedStories, setAccountSavedStories] = useState<NewsStory[]>([]);
  const [screen, setScreen] = useState<Screen>("home");
  const [returnScreen, setReturnScreen] = useState<Screen>("home");
  const [membershipReturnScreen, setMembershipReturnScreen] = useState<Screen>("home");
  const [activeIndex, setActiveIndex] = useState(0);
  const [detailStories, setDetailStories] = useState<NewsStory[]>(initialBrief.stories);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NewsStory[]>([]);
  const [pendingBrief, setPendingBrief] = useState<DailyBrief | null>(null);
  const [pendingBriefFetchedAt, setPendingBriefFetchedAt] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(initialBrief.generatedAt);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [price, setPrice] = useState<BillingPrice | null>(null);
  const [isPriceLoading, setIsPriceLoading] = useState(true);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const briefRef = useRef(brief);
  const refreshingRef = useRef(false);
  const settingsSaveRef = useRef(false);
  const lastSavedSettingsRef = useRef(JSON.stringify(defaultStoredState.settings));
  const accessToken = session?.access_token ?? null;
  const activeProfile = profile ?? localDemoAccount;
  const day = todayKey();

  useEffect(() => {
    briefRef.current = brief;
  }, [brief]);

  useEffect(() => {
    if (bypassAuthForTests) {
      setIsPriceLoading(false);
      return;
    }

    let mounted = true;
    fetch("/api/billing/price")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Price unavailable");
        }
        return response.json() as Promise<BillingPrice>;
      })
      .then((data) => {
        if (mounted) {
          setPrice(data);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) {
          setIsPriceLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [bypassAuthForTests]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 2600);
  }, []);

  useEffect(() => {
    if (bypassAuthForTests) {
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      const rawDemo = window.localStorage.getItem("dumb-news:demo-account");
      if (rawDemo) {
        const demo = JSON.parse(rawDemo) as AccountProfile;
        setLocalDemoAccount(demo);
        setProfile(demo);
        setAccountReady(true);
      }
      setAuthReady(true);
      return;
    }

    window.localStorage.removeItem("dumb-news:demo-account");
    setLocalDemoAccount(null);

    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) {
        return;
      }

      setSession(data.session);
      setAccountReady(!data.session);
      setAuthReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAccountReady(!nextSession);
      setAuthReady(true);
      if (!nextSession) {
        setProfile(null);
        setState(defaultStoredState);
        setAccountSavedStories([]);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [bypassAuthForTests]);

  useEffect(() => {
    if (bypassAuthForTests || !accessToken) {
      return;
    }

    setAccountReady(false);
    authenticatedFetch("/api/account", accessToken)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Account load failed");
        }
        return response.json() as Promise<{ profile: AccountProfile; state: StoredState; savedStories?: NewsStory[] }>;
      })
      .then((account) => {
        setProfile(account.profile);
        lastSavedSettingsRef.current = JSON.stringify(account.state.settings);
        setState(account.state);
        setAccountSavedStories(account.savedStories ?? []);
        settingsSaveRef.current = true;
        setAccountReady(true);
      })
      .catch(() => {
        setAuthError("Could not load your account. Check the Supabase server keys and database schema.");
        setAccountReady(true);
      });
  }, [accessToken, bypassAuthForTests]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (supabase && !localDemoAccount) {
      return;
    }

    const stored = loadStoredState();
    if ((!accessToken || localDemoAccount) && !bypassAuthForTests) {
      setState(stored);
    }
  }, [accessToken, bypassAuthForTests, localDemoAccount]);

  useEffect(() => {
    saveStoredState(state);
    const serializedSettings = JSON.stringify(state.settings);
    if (!accessToken || !settingsSaveRef.current || lastSavedSettingsRef.current === serializedSettings) {
      return;
    }

    lastSavedSettingsRef.current = serializedSettings;
    authenticatedFetch("/api/account/settings", accessToken, {
      method: "PUT",
      body: JSON.stringify({ settings: state.settings })
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Settings save failed");
        }
        showToast("SETTINGS SAVED");
      })
      .catch(() => showToast("SETTINGS SAVE FAILED"));
  }, [accessToken, showToast, state]);

  useEffect(() => {
    window.localStorage.setItem("dumb-news:last-brief", JSON.stringify(brief));
  }, [brief]);

  const pendingStoryCount = useMemo(() => {
    if (!pendingBrief) {
      return 0;
    }

    const currentIds = new Set(brief.stories.map((story) => story.id));
    return pendingBrief.stories.filter((story) => !currentIds.has(story.id)).length;
  }, [brief.stories, pendingBrief]);

  const refreshBrief = useCallback(async ({
    applyImmediately = false,
    force = false,
    signal
  }: {
    applyImmediately?: boolean;
    force?: boolean;
    signal?: AbortSignal;
  } = {}) => {
    if (refreshingRef.current) {
      return;
    }

    refreshingRef.current = true;
    setIsRefreshing(true);
    setRefreshError(false);

    try {
      const response = await fetch(`/api/brief${force ? "?refresh=1" : ""}`, {
        signal,
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
      });
      if (!response.ok) {
        throw new Error("Brief refresh failed");
      }

      const nextBrief = (await response.json()) as DailyBrief;
      const fetchedAt = new Date().toISOString();
      const currentIds = new Set(briefRef.current.stories.map((story) => story.id));
      const hasNewStories = nextBrief.stories.some((story) => !currentIds.has(story.id));

      if (applyImmediately || !hasNewStories) {
        setBrief(nextBrief);
        setPendingBrief(null);
        setPendingBriefFetchedAt(null);
        setLastUpdated(fetchedAt);
      } else {
        setPendingBrief(nextBrief);
        setPendingBriefFetchedAt(fetchedAt);
      }
    } catch (error) {
      if ((error as DOMException).name === "AbortError") {
        return;
      }

      setRefreshError(true);
      const cached = window.localStorage.getItem("dumb-news:last-brief");
      if (cached && applyImmediately) {
        const cachedBrief = JSON.parse(cached) as DailyBrief;
        setBrief(cachedBrief);
      }
    } finally {
      refreshingRef.current = false;
      if (!signal?.aborted) {
        setIsRefreshing(false);
      }
    }
  }, [accessToken]);

  useEffect(() => {
    const controller = new AbortController();

    function poll() {
      if (document.visibilityState === "visible") {
        refreshBrief({ signal: controller.signal });
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refreshBrief({ force: true, signal: controller.signal });
      }
    }

    const interval = window.setInterval(poll, brief.refreshIntervalMs ?? FALLBACK_POLL_MS);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [brief.refreshIntervalMs, refreshBrief]);

  useEffect(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      setSearchResults([]);
      return;
    }

    const localResults = brief.stories.filter((story) =>
      [story.headline, story.summary].join(" ").toLowerCase().includes(needle)
    );
    setSearchResults(localResults);

    startTransition(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
      })
        .then((response) => response.json())
        .then((data: { stories: NewsStory[] }) => {
          if (data.stories.length > 0) {
            setSearchResults(data.stories);
          }
        })
        .catch(() => undefined);
    });
  }, [accessToken, brief.stories, query]);

  const visibleStories = useMemo(() => {
    return brief.stories.filter((story) => {
      return state.settings.categories.includes(story.category);
    });
  }, [brief.stories, state.settings.categories]);

  useEffect(() => {
    if (screen === "detail") {
      return;
    }

    setDetailStories(visibleStories);
    setActiveIndex((current) => Math.min(current, Math.max(visibleStories.length - 1, 0)));
  }, [screen, visibleStories]);

  const savedStories = useMemo(() => {
    const saved = new Set(state.savedIds);
    const byId = new Map<string, NewsStory>();

    for (const story of [...accountSavedStories, ...brief.stories]) {
      if (saved.has(story.id)) {
        byId.set(story.id, story);
      }
    }

    return [...byId.values()];
  }, [accountSavedStories, brief.stories, state.savedIds]);

  const readIds = state.readIdsByDate[day] ?? [];
  const activeStory = detailStories[activeIndex] ?? detailStories[0] ?? visibleStories[0];
  const completed = visibleStories.length > 0 && visibleStories.every((story) => readIds.includes(story.id));

  function updateState(updater: (current: StoredState) => StoredState) {
    setState((current) => updater(current));
  }

  function markRead(storyId: string) {
    updateState((current) => {
      const existing = current.readIdsByDate[day] ?? [];
      if (existing.includes(storyId)) {
        return current;
      }

      return {
        ...current,
        readIdsByDate: {
          ...current.readIdsByDate,
          [day]: [...existing, storyId]
        }
      };
    });

    if (accessToken) {
      authenticatedFetch("/api/account/read", accessToken, {
        method: "POST",
        body: JSON.stringify({ storyId })
      }).catch(() => undefined);
    }
  }

  function selectStory(storySet: NewsStory[], index: number, nextReturnScreen: Screen, showDetail: boolean) {
    const story = storySet[index];
    if (!story) {
      return;
    }

    setDetailStories(storySet);
    setActiveIndex(index);
    setReturnScreen(nextReturnScreen);
    markRead(story.id);
    if (showDetail) {
      setScreen("detail");
    }
  }

  function openStory(index: number) {
    selectStory(visibleStories, index, "home", true);
  }

  function openStoryFromSet(storySet: NewsStory[], story: NewsStory, nextReturnScreen: Screen) {
    selectStory(storySet, storySet.findIndex((item) => item.id === story.id), nextReturnScreen, true);
  }

  function goBackFromDetail() {
    setScreen(returnScreen === "detail" ? "home" : returnScreen);
  }

  function changeScreen(nextScreen: Screen) {
    if (nextScreen === "membership" && screen !== "membership") {
      setMembershipReturnScreen(screen === "detail" ? returnScreen : screen);
    }
    setScreen(nextScreen);
  }

  function goBackFromMembership() {
    setScreen(membershipReturnScreen === "membership" ? "home" : membershipReturnScreen);
  }

  function goNext() {
    const nextIndex = activeIndex + 1;

    if (nextIndex >= detailStories.length) {
      setScreen("complete");
      return;
    }

    setActiveIndex(nextIndex);
    markRead(detailStories[nextIndex].id);
  }

  function goPrev() {
    const prevIndex = Math.max(0, activeIndex - 1);
    setActiveIndex(prevIndex);
    markRead(detailStories[prevIndex].id);
  }

  function toggleSaved(storyId: string) {
    const shouldSave = !state.savedIds.includes(storyId);
    const story = [...brief.stories, ...detailStories].find((item) => item.id === storyId);
    updateState((current) => {
      const saved = new Set(current.savedIds);
      if (saved.has(storyId)) {
        saved.delete(storyId);
      } else {
        saved.add(storyId);
      }

      return {
        ...current,
        savedIds: [...saved]
      };
    });

    setAccountSavedStories((current) => {
      if (shouldSave && story && !current.some((item) => item.id === story.id)) {
        return [story, ...current];
      }

      if (!shouldSave) {
        return current.filter((item) => item.id !== storyId);
      }

      return current;
    });

    if (accessToken) {
      authenticatedFetch("/api/account/saved", accessToken, {
        method: "PUT",
        body: JSON.stringify({ storyId, saved: shouldSave })
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Save failed");
          }
          showToast(shouldSave ? "STORY SAVED" : "STORY UNSAVED");
        })
        .catch(() => showToast("SAVE FAILED"));
    }
  }

  function handleSearch(value: string) {
    setQuery(value);
  }

  function applyPendingBrief() {
    if (!pendingBrief) {
      return;
    }

    setBrief(pendingBrief);
    setLastUpdated(pendingBriefFetchedAt ?? new Date().toISOString());
    setPendingBrief(null);
    setPendingBriefFetchedAt(null);
    setReturnScreen("home");
    setActiveIndex(0);
    setScreen("home");
  }

  async function shareStory() {
    if (!activeStory) {
      return;
    }

    const text = `${activeStory.headline}\n\n${activeStory.summary}\n\nSource: ${activeStory.source}\n${activeStory.url}`;
    if (navigator.share) {
      await navigator.share({ title: activeStory.headline, text, url: activeStory.url }).catch(() => undefined);
      showToast("SHARED");
      return;
    }

    await navigator.clipboard?.writeText(text).catch(() => undefined);
    showToast("COPIED");
  }

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase?.auth.signOut();
    setSession(null);
    setLocalDemoAccount(null);
    setProfile(null);
    window.localStorage.removeItem("dumb-news:demo-account");
    setState(defaultStoredState);
    setAccountSavedStories([]);
    setAccountReady(true);
    setScreen("home");
    window.location.href = "/login";
  }

  function continueWithLocalDemo(email: string) {
    const demoProfile: AccountProfile = {
      email: email || "demo@dumb.news",
      membershipTier: "free"
    };
    window.localStorage.setItem("dumb-news:demo-account", JSON.stringify(demoProfile));
    setLocalDemoAccount(demoProfile);
    setProfile(demoProfile);
    setAccountReady(true);
    setAuthError(null);
  }

  async function startCheckout() {
    if (!accessToken) {
      return;
    }

    setIsCheckoutLoading(true);
    try {
      const response = await authenticatedFetch("/api/billing/checkout", accessToken, { method: "POST" });
      const data = (await response.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }

      showToast(data.error ?? "CHECKOUT FAILED");
    } catch {
      showToast("CHECKOUT FAILED");
    } finally {
      setIsCheckoutLoading(false);
    }
  }

  async function openCustomerPortal() {
    if (!accessToken) {
      return;
    }

    setIsPortalLoading(true);
    try {
      const response = await authenticatedFetch("/api/billing/portal", accessToken, { method: "POST" });
      const data = (await response.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }

      showToast(data.error ?? "PORTAL FAILED");
    } catch {
      showToast("PORTAL FAILED");
    } finally {
      setIsPortalLoading(false);
    }
  }

  if (!authReady) {
    return (
      <main className="stage theme-light font-normal">
        <AuthScreen mode="loading" />
      </main>
    );
  }

  if (!bypassAuthForTests && session && !accountReady) {
    return (
      <main className="stage theme-light font-normal">
        <AuthScreen mode="loading" />
      </main>
    );
  }

  if (!bypassAuthForTests && !session && !localDemoAccount) {
    return (
      <main className="stage theme-light font-normal">
        <AuthScreen error={authError} mode="auth" onError={setAuthError} onLocalDemo={continueWithLocalDemo} />
      </main>
    );
  }

  return (
    <main className={`stage theme-${state.settings.theme} font-normal`}>
      <section className="phone mobileApp" aria-label="Dumb News mobile app">
        <StatusBar dateLabel={monthDay()} />
        {screen === "home" && (
          <HomeScreen
            brief={brief}
            completed={completed}
            isRefreshing={isRefreshing}
            lastUpdated={lastUpdated}
            onOpenStory={openStory}
            onShowNewStories={applyPendingBrief}
            pendingStoryCount={pendingStoryCount}
            readIds={readIds}
            refreshError={refreshError}
            stories={visibleStories}
          />
        )}
        {screen === "detail" && activeStory && (
          <DetailScreen
            index={activeIndex}
            isSaved={state.savedIds.includes(activeStory.id)}
            onBack={goBackFromDetail}
            onNext={goNext}
            onPrev={goPrev}
            onShare={shareStory}
            onToggleSaved={() => toggleSaved(activeStory.id)}
            story={activeStory}
            total={detailStories.length}
          />
        )}
        {screen === "saved" && (
          <ListScreen
            empty="NO SAVED STORIES."
            onOpenStory={(story) => openStoryFromSet(savedStories, story, "saved")}
            stories={savedStories}
            title="SAVED"
          />
        )}
        {screen === "search" && (
          <SearchScreen
            isPending={isPending}
            onOpenStory={(story) => openStoryFromSet(searchResults, story, "search")}
            onSearch={handleSearch}
            query={query}
            results={searchResults}
          />
        )}
        {screen === "settings" && (
          <SettingsScreen
            onSignOut={signOut}
            profile={activeProfile}
            state={state}
            updateState={updateState}
          />
        )}
        {screen === "complete" && <CompleteScreen onHome={() => setScreen("home")} />}
        {screen !== "detail" && <BottomNav current={screen} onChange={setScreen} />}
      </section>
      <DesktopShell
        activeIndex={activeIndex}
        activeStory={activeStory}
        brief={brief}
        completed={completed}
        current={screen}
        dateLabel={monthDay()}
        isPending={isPending}
        isCheckoutLoading={isCheckoutLoading}
        isPortalLoading={isPortalLoading}
        isPriceLoading={isPriceLoading}
        isRefreshing={isRefreshing}
        lastUpdated={lastUpdated}
        onBack={goBackFromDetail}
        onChangeScreen={changeScreen}
        onMembershipBack={goBackFromMembership}
        onManageBilling={openCustomerPortal}
        onShowNewStories={applyPendingBrief}
        onSignOut={signOut}
        onHome={() => setScreen("home")}
        onNext={goNext}
        onOpenStory={openStoryFromSet}
        onPrev={goPrev}
        onSearch={handleSearch}
        onShare={shareStory}
        onToggleSaved={() => activeStory && toggleSaved(activeStory.id)}
        onUpgrade={startCheckout}
        query={query}
        readIds={readIds}
        refreshError={refreshError}
        savedIds={state.savedIds}
        savedStories={savedStories}
        searchResults={searchResults}
        state={state}
        stories={visibleStories}
        pendingStoryCount={pendingStoryCount}
        price={price}
        profile={activeProfile}
        total={detailStories.length}
        updateState={updateState}
      />
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

function StatusBar({ dateLabel }: { dateLabel: string }) {
  const [time, setTime] = useState("12:30 PM");

  useEffect(() => {
    setTime(shortTime());
    const id = window.setInterval(() => setTime(shortTime()), 30000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <header className="status">
      <time suppressHydrationWarning>{time}</time>
      <span suppressHydrationWarning>{dateLabel}</span>
    </header>
  );
}

function AuthScreen({
  error,
  mode,
  onError,
  onLocalDemo
}: {
  error?: string | null;
  mode: "auth" | "loading";
  onError?: (message: string | null) => void;
  onLocalDemo?: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = getSupabaseBrowserClient();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    onError?.(null);

    if (!supabase) {
      onLocalDemo?.(email);
      return;
    }

    setIsSubmitting(true);
    const result = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    setIsSubmitting(false);

    if (result.error) {
      onError?.(result.error.message);
      return;
    }

    if (isSignUp && !result.data.session) {
      onError?.("Check your email to confirm your account, then log in.");
    }
  }

  return (
    <section className="authShell" aria-label="Dumb News account access">
      <div className="authBox">
        <h1>DUMB NEWS</h1>
        <p>NEWS FOR DUMMIES.</p>
        {mode === "loading" ? (
          <div className="emptyState">LOADING ACCOUNT...</div>
        ) : (
          <form className="authForm" noValidate={!supabase} onSubmit={submit}>
            <label>
              EMAIL
              <input
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                required={Boolean(supabase)}
                type="email"
                value={email}
              />
            </label>
            <label>
              PASSWORD
              <input
                autoComplete={isSignUp ? "new-password" : "current-password"}
                minLength={6}
                onChange={(event) => setPassword(event.target.value)}
                required={Boolean(supabase)}
                type="password"
                value={password}
              />
            </label>
            {error && <div className="authError">{error}</div>}
            {!supabase && <div className="authError">LOCAL DEMO MODE. ADD SUPABASE ENV VARS FOR REAL ACCOUNTS.</div>}
            <button className="hardButton" disabled={isSubmitting} type="submit">
              {isSubmitting ? "WORKING..." : !supabase ? "LOG IN LOCAL" : isSignUp ? "SIGN UP" : "LOG IN"}
            </button>
            {!supabase && (
              <button className="hardButton" type="button" onClick={() => onLocalDemo?.(email)}>
                CONTINUE LOCAL DEMO
              </button>
            )}
            <button className="plainSwitch" type="button" onClick={() => setIsSignUp((current) => !current)}>
              {isSignUp ? "HAVE AN ACCOUNT? LOG IN" : "NEED AN ACCOUNT? SIGN UP"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

function HomeScreen({
  brief,
  completed,
  isRefreshing,
  lastUpdated,
  onOpenStory,
  onShowNewStories,
  pendingStoryCount,
  readIds,
  refreshError,
  stories
}: {
  brief: DailyBrief;
  completed: boolean;
  isRefreshing: boolean;
  lastUpdated: string;
  onOpenStory: (index: number) => void;
  onShowNewStories: () => void;
  pendingStoryCount: number;
  readIds: string[];
  refreshError: boolean;
  stories: NewsStory[];
}) {
  return (
    <div className="screen homeScreen">
      <section className="brandBlock">
        <h1>DUMB NEWS</h1>
        <p>News for dummies.</p>
      </section>
      <div className="dateRail">
        <span>TODAY</span>
      </div>
      <div className="readTime">
        <span>TODAY&apos;S NEWS: {brief.readTimeMinutes} MINUTES</span>
        <span>{stories.length} NEWS</span>
        <span suppressHydrationWarning>{updatedStatus(lastUpdated, isRefreshing, refreshError)}</span>
      </div>
      {pendingStoryCount > 0 && (
        <button className="newStoriesButton" type="button" onClick={onShowNewStories}>
          {pendingStoryCount} NEW STORIES
        </button>
      )}
      {completed && <div className="completeBanner">YOU ARE NOW INFORMED.</div>}
      <ol className="storyList">
        {stories.map((story, index) => (
          <li key={story.id}>
            <button className="storyRow" type="button" onClick={() => onOpenStory(index)}>
              <CategoryIcon category={story.category} className="categoryIcon" />
              <span className="storyText">
                <span className="categoryLabel">{story.category}</span>
                <span className="headline">{story.headline}</span>
                <span className="storyMeta" suppressHydrationWarning>
                  {readIds.includes(story.id) ? "READ / " : ""}
                  {new Date(story.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </span>
              </span>
              <span className="chevron">›</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function DesktopShell({
  activeIndex,
  activeStory,
  brief,
  completed,
  current,
  dateLabel,
  isPending,
  isCheckoutLoading,
  isPortalLoading,
  isPriceLoading,
  isRefreshing,
  lastUpdated,
  onBack,
  onChangeScreen,
  onManageBilling,
  onMembershipBack,
  onShowNewStories,
  onSignOut,
  onHome,
  onNext,
  onOpenStory,
  onPrev,
  onSearch,
  onShare,
  onToggleSaved,
  onUpgrade,
  query,
  readIds,
  savedIds,
  savedStories,
  searchResults,
  state,
  stories,
  pendingStoryCount,
  price,
  profile,
  refreshError,
  total,
  updateState
}: {
  activeIndex: number;
  activeStory?: NewsStory;
  brief: DailyBrief;
  completed: boolean;
  current: Screen;
  dateLabel: string;
  isPending: boolean;
  isCheckoutLoading: boolean;
  isPortalLoading: boolean;
  isPriceLoading: boolean;
  isRefreshing: boolean;
  lastUpdated: string;
  onBack: () => void;
  onChangeScreen: (screen: Screen) => void;
  onManageBilling: () => void;
  onMembershipBack: () => void;
  onShowNewStories: () => void;
  onSignOut: () => void;
  onHome: () => void;
  onNext: () => void;
  onOpenStory: (storySet: NewsStory[], story: NewsStory, nextReturnScreen: Screen) => void;
  onPrev: () => void;
  onSearch: (value: string) => void;
  onShare: () => void;
  onToggleSaved: () => void;
  onUpgrade: () => void;
  query: string;
  readIds: string[];
  savedIds: string[];
  savedStories: NewsStory[];
  searchResults: NewsStory[];
  state: StoredState;
  stories: NewsStory[];
  pendingStoryCount: number;
  price: BillingPrice | null;
  profile: AccountProfile | null;
  refreshError: boolean;
  total: number;
  updateState: (updater: (current: StoredState) => StoredState) => void;
}) {
  const isSaved = activeStory ? savedIds.includes(activeStory.id) : false;
  const desktopList = current === "saved" ? savedStories : current === "search" ? searchResults : stories;
  const desktopListTitle = current === "saved" ? "SAVED" : current === "search" ? "SEARCH" : "TOP STORIES";
  const detailReturn = current === "saved" ? "saved" : current === "search" ? "search" : "home";
  const showList = current === "home" || current === "saved" || current === "search";

  return (
    <section className="webApp" aria-label="Dumb News web app">
      <header className="webHeader">
        <div className="webBrand">
          <h1>DUMB NEWS</h1>
          <p>NEWS FOR DUMMIES.</p>
        </div>
        <div className="webHeaderMeta">
          <span suppressHydrationWarning>{dateLabel}</span>
        </div>
      </header>
      <div className="webBody">
        <aside className="webSidebar" aria-label="Main navigation">
          <DesktopNav current={current} onChange={onChangeScreen} />
          <div className="webBriefCard">
            <span>TODAY&apos;S NEWS</span>
            <strong>{stories.length}</strong>
            <span>news</span>
            <span>~{brief.readTimeMinutes} min read</span>
            <span suppressHydrationWarning>{updatedStatus(lastUpdated, isRefreshing, refreshError)}</span>
            {pendingStoryCount > 0 && (
              <button className="newStoriesButton compactUpdate" type="button" onClick={onShowNewStories}>
                {pendingStoryCount} NEW STORIES
              </button>
            )}
          </div>
        </aside>
        {showList && (
          <section className="webListPanel">
              <div className="webPanelTitle">{desktopListTitle}</div>
              {pendingStoryCount > 0 && current === "home" && (
                <button className="newStoriesButton webUpdateButton" type="button" onClick={onShowNewStories}>
                  {pendingStoryCount} NEW STORIES
                </button>
              )}
              {current === "search" && (
                <label className="searchBox webSearchBox">
                  <SearchIcon className="smallIcon" />
                  <input
                    aria-label="Search previous summaries"
                    onChange={(event) => onSearch(event.target.value)}
                    placeholder="TYPE WORDS"
                    value={query}
                  />
                </label>
              )}
              {current === "search" && isPending && <div className="emptyState">SEARCHING...</div>}
              {current === "search" && !isPending && query && desktopList.length === 0 && (
                <div className="emptyState">NOTHING FOUND.</div>
              )}
              {desktopList.length === 0 && current !== "search" ? (
                <div className="emptyState">{current === "saved" ? "NO SAVED STORIES." : "NO STORIES MATCH THESE CATEGORIES."}</div>
              ) : (
                <StoryList
                  activeId={activeStory?.id}
                  onOpenStory={(story) => onOpenStory(desktopList, story, detailReturn)}
                  readIds={readIds}
                  stories={desktopList}
                />
              )}
            </section>
        )}
        {current === "detail" && (
          <section className="webDetailPage">
            {activeStory ? (
              <DetailScreen
                index={activeIndex}
                isSaved={isSaved}
                onBack={onBack}
                onNext={onNext}
                onPrev={onPrev}
                onShare={onShare}
                onToggleSaved={onToggleSaved}
                story={activeStory}
                total={total}
              />
            ) : (
              <div className="emptyState">NO STORY SELECTED.</div>
            )}
          </section>
        )}
        {current === "settings" && (
          <section className="webUtilityPanel">
            <SettingsScreen
              onSignOut={onSignOut}
              profile={profile}
              state={state}
              updateState={updateState}
            />
          </section>
        )}
        {current === "membership" && (
          <section className="webUtilityPanel">
            <MembershipScreen
              isCheckoutLoading={isCheckoutLoading}
              isPortalLoading={isPortalLoading}
              isPriceLoading={isPriceLoading}
              onBack={onMembershipBack}
              onManageBilling={onManageBilling}
              onUpgrade={onUpgrade}
              price={price}
              profile={profile}
            />
          </section>
        )}
        {current === "complete" && (
          <section className="webUtilityPanel">
            <CompleteScreen onHome={onHome} />
          </section>
        )}
      </div>
      {completed && current !== "complete" && <div className="webFooter">YOU ARE NOW INFORMED.</div>}
    </section>
  );
}

function DesktopNav({ current, onChange }: { current: Screen; onChange: (screen: Screen) => void }) {
  return (
    <nav className="webNav">
      <button className={current === "home" || current === "detail" || current === "complete" ? "active" : ""} type="button" onClick={() => onChange("home")}>
        <NewsIcon className="webNavIcon" />
        Today
      </button>
      <button className={current === "saved" ? "active" : ""} type="button" onClick={() => onChange("saved")}>
        <BookmarkIcon className="webNavIcon" />
        Saved
      </button>
      <button className={current === "search" ? "active" : ""} type="button" onClick={() => onChange("search")}>
        <SearchIcon className="webNavIcon" />
        Search
      </button>
      <button className={current === "settings" ? "active" : ""} type="button" onClick={() => onChange("settings")}>
        <SettingsIcon className="webNavIcon" />
        Settings
      </button>
      <button className={current === "membership" ? "active" : ""} type="button" onClick={() => onChange("membership")}>
        <BookmarkIcon className="webNavIcon" />
        Membership
      </button>
      <a href="/account">
        <PersonIcon className="webNavIcon" />
        Account
      </a>
    </nav>
  );
}

function StoryList({
  activeId,
  onOpenStory,
  readIds,
  stories
}: {
  activeId?: string;
  onOpenStory: (story: NewsStory) => void;
  readIds: string[];
  stories: NewsStory[];
}) {
  return (
    <ol className="storyList">
      {stories.map((story) => (
        <li key={story.id}>
          <button
            className={`storyRow ${activeId === story.id ? "selected" : ""}`}
            type="button"
            onClick={() => onOpenStory(story)}
          >
            <CategoryIcon category={story.category} className="categoryIcon" />
            <span className="storyText">
              <span className="categoryLabel">{story.category}</span>
              <span className="headline">{story.headline}</span>
              <span className="storyMeta" suppressHydrationWarning>
                {readIds.includes(story.id) ? "READ / " : ""}
                {new Date(story.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </span>
            </span>
            <span className="chevron">›</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function DetailScreen({
  index,
  isSaved,
  onBack,
  onNext,
  onPrev,
  onShare,
  onToggleSaved,
  story,
  total
}: {
  index: number;
  isSaved: boolean;
  onBack: () => void;
  onNext: () => void;
  onPrev: () => void;
  onShare: () => void;
  onToggleSaved: () => void;
  story: NewsStory;
  total: number;
}) {
  return (
    <div className="screen detailScreen">
      <div className="readerTop">
        <button type="button" onClick={onBack}>‹ BACK</button>
        <span>
          {index + 1} OF {total}
        </span>
      </div>
      <article className="article">
        <div className="articleCategory">{story.category}</div>
        <CategoryIcon category={story.category} className="heroIcon" />
        <h2>{story.headline}</h2>
        <div className="rule" />
        <section>
          <h3>SUMMARY</h3>
          <p>{story.summary}</p>
        </section>
        <section>
          <h3>WHY IT MATTERS</h3>
          <p>{story.whyItMatters}</p>
        </section>
        {story.background && (
          <section>
            <h3>BACKGROUND</h3>
            <p>{story.background}</p>
          </section>
        )}
        <section>
          <h3>SOURCE</h3>
          <a href={story.url} target="_blank" rel="noreferrer">
            {story.source}
          </a>
        </section>
      </article>
      <div className="readerActions">
        <button type="button" onClick={onPrev} disabled={index === 0}>
          ‹ PREV
        </button>
        <button type="button" onClick={onShare}>SHARE (OK)</button>
        <button type="button" onClick={onToggleSaved}>{isSaved ? "SAVED" : "SAVE"}</button>
        <button type="button" onClick={onNext}>NEXT ›</button>
      </div>
    </div>
  );
}

function ListScreen({
  empty,
  onOpenStory,
  stories,
  title
}: {
  empty: string;
  onOpenStory: (story: NewsStory) => void;
  stories: NewsStory[];
  title: string;
}) {
  return (
    <div className="screen utilityScreen">
      <div className="sectionTitle">{title}</div>
      {stories.length === 0 ? (
        <div className="emptyState">{empty}</div>
      ) : (
        <ol className="storyList compact">
          {stories.map((story) => (
            <li key={story.id}>
              <button className="storyRow" type="button" onClick={() => onOpenStory(story)}>
                <CategoryIcon category={story.category} className="categoryIcon" />
                <span className="storyText">
                  <span className="categoryLabel">{story.category}</span>
                  <span className="headline">{story.headline}</span>
                </span>
                <span className="chevron">›</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function SearchScreen({
  isPending,
  onOpenStory,
  onSearch,
  query,
  results
}: {
  isPending: boolean;
  onOpenStory: (story: NewsStory) => void;
  onSearch: (value: string) => void;
  query: string;
  results: NewsStory[];
}) {
  return (
    <div className="screen utilityScreen">
      <div className="sectionTitle">SEARCH</div>
      <label className="searchBox">
        <SearchIcon className="smallIcon" />
        <input
          aria-label="Search previous summaries"
          onChange={(event) => onSearch(event.target.value)}
          placeholder="TYPE WORDS"
          value={query}
        />
      </label>
      {isPending && <div className="emptyState">SEARCHING...</div>}
      {!isPending && query && results.length === 0 && <div className="emptyState">NOTHING FOUND.</div>}
      <ol className="storyList compact">
        {results.map((story) => (
          <li key={story.id}>
            <button className="storyRow" type="button" onClick={() => onOpenStory(story)}>
              <CategoryIcon category={story.category} className="categoryIcon" />
              <span className="storyText">
                <span className="categoryLabel">{story.category}</span>
                <span className="headline">{story.headline}</span>
              </span>
              <span className="chevron">›</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function MembershipScreen({
  isCheckoutLoading,
  isPortalLoading,
  isPriceLoading,
  onBack,
  onManageBilling,
  onUpgrade,
  price,
  profile
}: {
  isCheckoutLoading: boolean;
  isPortalLoading: boolean;
  isPriceLoading: boolean;
  onBack: () => void;
  onManageBilling: () => void;
  onUpgrade: () => void;
  price: BillingPrice | null;
  profile: AccountProfile | null;
}) {
  const isPaid = profile?.membershipTier === "paid";

  return (
    <div className="screen utilityScreen membershipScreen">
      <div className="readerTop membershipTop">
        <button type="button" onClick={onBack}>‹ BACK</button>
        <span>MEMBERSHIP</span>
      </div>
      <div className="membershipPlans">
        <section className={`planBox ${!isPaid ? "selected" : ""}`}>
          <span className="planEyebrow">CURRENT DEFAULT</span>
          <h2>FREE</h2>
          <strong>10 NEWS</strong>
          <p>Latest stories refresh every 10 minutes while the app is open.</p>
          {!isPaid && <div className="planStatus">YOUR PLAN</div>}
        </section>
        <section className={`planBox ${isPaid ? "selected" : ""}`}>
          <span className="planEyebrow">PRO</span>
          <h2>{isPriceLoading ? "LOADING..." : price?.display ?? "$2.50 / month"}</h2>
          <strong>ALL CACHED NEWS</strong>
          <p>Shows every cached story available in the news backend with faster 5 minute refresh.</p>
          {isPaid ? (
            <button className="hardButton" disabled={isPortalLoading} type="button" onClick={onManageBilling}>
              {isPortalLoading ? "OPENING..." : "MANAGE PRO"}
            </button>
          ) : (
            <button className="hardButton" disabled={isCheckoutLoading || isPriceLoading} type="button" onClick={onUpgrade}>
              {isCheckoutLoading ? "OPENING..." : "GET PRO"}
            </button>
          )}
        </section>
      </div>
    </div>
  );
}

function SettingsScreen({
  onSignOut,
  profile,
  state,
  updateState
}: {
  onSignOut: () => void;
  profile: AccountProfile | null;
  state: StoredState;
  updateState: (updater: (current: StoredState) => StoredState) => void;
}) {
  function toggleCategory(category: NewsCategory) {
    updateState((current) => {
      const enabled = new Set(current.settings.categories);
      if (enabled.has(category)) {
        enabled.delete(category);
      } else {
        enabled.add(category);
      }

      return {
        ...current,
        settings: {
          ...current.settings,
          categories: [...enabled]
        }
      };
    });
  }

  return (
    <div className="screen utilityScreen">
      <div className="sectionTitle">SETTINGS</div>
      <div className="settingBlock accountBlock">
        <span>ACCOUNT</span>
        <strong>{profile?.email ?? "SIGNED IN"}</strong>
        <span>{profile?.membershipTier === "paid" ? "PAID / ALL NEWS" : "FREE / 10 NEWS"}</span>
        {profile?.subscriptionStatus && <span>STATUS: {profile.subscriptionStatus}</span>}
        {profile?.currentPeriodEnd && (
          <span suppressHydrationWarning>
            RENEWS: {new Date(profile.currentPeriodEnd).toLocaleDateString("en-US")}
          </span>
        )}
        <div className="accountActions">
          <button className="hardButton secondary" type="button" onClick={onSignOut}>
            LOG OUT
          </button>
        </div>
      </div>
      <div className="settingBlock">
        <label>
          THEME
          <select
            value={state.settings.theme}
            onChange={(event) =>
              updateState((current) => ({
                ...current,
                settings: { ...current.settings, theme: event.target.value as StoredState["settings"]["theme"] }
              }))
            }
          >
            <option value="light">LIGHT</option>
            <option value="dark">DARK</option>
            <option value="warm">WARM</option>
          </select>
        </label>
      </div>
      <div className="sectionTitle small">CATEGORIES</div>
      <div className="categoryGrid">
        {CATEGORIES.map((category) => (
          <label key={category} className="checkRow">
            <input
              checked={state.settings.categories.includes(category)}
              onChange={() => toggleCategory(category)}
              type="checkbox"
            />
            {category}
          </label>
        ))}
      </div>
    </div>
  );
}

function CompleteScreen({ onHome }: { onHome: () => void }) {
  return (
    <div className="screen completeScreen">
      <div className="sectionTitle">DONE</div>
      <div className="doneCopy">
        <strong>YOU ARE NOW INFORMED.</strong>
        <span>NO MORE NEWS TODAY.</span>
      </div>
      <button className="hardButton" type="button" onClick={onHome}>
        BACK TO TODAY
      </button>
    </div>
  );
}

function BottomNav({ current, onChange }: { current: Screen; onChange: (screen: Screen) => void }) {
  return (
    <nav className="bottomNav" aria-label="Main navigation">
      <button className={current === "home" || current === "detail" || current === "complete" ? "active" : ""} type="button" onClick={() => onChange("home")}>
        <NewsIcon className="navIcon" />
        NEWS
      </button>
      <button className={current === "saved" ? "active" : ""} type="button" onClick={() => onChange("saved")}>
        <BookmarkIcon className="navIcon" />
        SAVED
      </button>
      <button className={current === "search" ? "active" : ""} type="button" onClick={() => onChange("search")}>
        <SearchIcon className="navIcon" />
        SEARCH
      </button>
      <button className={current === "settings" ? "active" : ""} type="button" onClick={() => onChange("settings")}>
        <SettingsIcon className="navIcon" />
        SETTINGS
      </button>
    </nav>
  );
}

import type { NewsCategory } from "./news/types";

const STORAGE_VERSION = "dumb-news:v1";

export type StoredState = {
  version: string;
  savedIds: string[];
  readIdsByDate: Record<string, string[]>;
  settings: {
    theme: "light" | "dark" | "warm";
    categories: NewsCategory[];
    notificationTime: string;
    fontSize: "small" | "normal" | "large";
  };
};

export const defaultStoredState: StoredState = {
  version: STORAGE_VERSION,
  savedIds: [],
  readIdsByDate: {},
  settings: {
    theme: "light",
    categories: ["top", "world", "politics", "business", "technology", "science", "health", "sports"],
    notificationTime: "08:00",
    fontSize: "normal"
  }
};

type RawStoredState = Omit<StoredState, "settings"> & {
  settings?: Partial<Omit<StoredState["settings"], "theme">> & { theme?: string };
};

export function loadStoredState(): StoredState {
  if (typeof window === "undefined") {
    return defaultStoredState;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_VERSION);
    if (!raw) {
      return defaultStoredState;
    }

    const parsed = JSON.parse(raw) as RawStoredState;
    if (parsed.version !== STORAGE_VERSION) {
      return defaultStoredState;
    }

    const rawTheme = parsed.settings?.theme;
    const theme =
      rawTheme === "mono" || rawTheme === "dark"
        ? "dark"
        : rawTheme === "warm"
          ? "warm"
          : defaultStoredState.settings.theme;

    return {
      ...defaultStoredState,
      ...parsed,
      settings: {
        ...defaultStoredState.settings,
        ...parsed.settings,
        theme: theme ?? defaultStoredState.settings.theme
      }
    };
  } catch {
    return defaultStoredState;
  }
}

export function saveStoredState(state: StoredState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_VERSION, JSON.stringify(state));
}

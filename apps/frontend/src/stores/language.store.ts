import { create } from "zustand";
import type { LanguagePreference } from "@/types/settings";
import { readLanguageFromCookie, setUiTextLanguage } from "@/locales";

const STORAGE_KEY = "cashflow.language";
const COOKIE_KEY = "cashflow.language";
const DEFAULT_LANGUAGE: LanguagePreference = "id";
const PRESERVED_SCROLL_SELECTOR =
  ".dashboard-main-scroll, [data-scroll-preserve]";

function captureScrollPositions(): Array<{ top: number; left: number }> {
  if (typeof document === "undefined") return [];
  return Array.from(
    document.querySelectorAll<HTMLElement>(PRESERVED_SCROLL_SELECTOR),
  ).map(({ scrollTop, scrollLeft }) => ({ top: scrollTop, left: scrollLeft }));
}

function restoreScrollPositions(
  positions: Array<{ top: number; left: number }>,
): void {
  if (typeof document === "undefined" || positions.length === 0) return;

  const restore = () => {
    const containers = document.querySelectorAll<HTMLElement>(
      PRESERVED_SCROLL_SELECTOR,
    );
    positions.forEach(({ top, left }, index) => {
      const container = containers[index];
      if (!container) return;
      container.scrollTop = top;
      container.scrollLeft = left;
    });
  };

  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(restore);
  } else {
    window.setTimeout(restore, 0);
  }
}

export function hydrateLanguagePreference(): LanguagePreference {
  const active = readStored();
  setUiTextLanguage(active);
  useLanguageStore.setState({ language: active });
  return active;
}

function readStored(): LanguagePreference {
  // Prefer the cookie: it is the SAME source the server used during SSR
  // (layout.tsx), so hydrating from it avoids any post-mount language swap.
  // localStorage remains as a fallback for legacy sessions without a cookie.
  const cookieValue = readLanguageFromCookie();
  if (cookieValue === "en") return "en";
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === "en" ? "en" : DEFAULT_LANGUAGE;
}

export function hasStoredLanguagePreference(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const cookieValue = readLanguageFromCookie();
  return (
    cookieValue === "en" ||
    window.localStorage.getItem(STORAGE_KEY) === "id" ||
    window.localStorage.getItem(STORAGE_KEY) === "en"
  );
}

function persist(language: LanguagePreference): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, language);
    // Mirror to a cookie so the SERVER can also read the active language and
    // render the same uiText during SSR. Without this, a user who picked
    // "en" gets server-rendered Indonesian HTML + client-rendered English,
    // which is exactly the hydration mismatch that makes React throw away
    // the whole tree (white flash on navigation / refresh).
    document.cookie = `${COOKIE_KEY}=${language}; path=/; max-age=31536000; samesite=lax`;
  }
}

interface LanguageState {
  language: LanguagePreference;
  setLanguage: (language: LanguagePreference) => LanguagePreference;
}

/**
 * Single source of truth for the UI language.
 *
 * - Persisted across reloads / navigation / logout-login via localStorage.
 * - Reconciles with the backend settings (authoritative) once loaded.
 * - Each switch updates the shared `uiText` binding so static-language
 *   consumers (`import { uiText } from "@/locales"`) read the new language on
 *   their next render.
 */
export const useLanguageStore = create<LanguageState>((set) => ({
  // Initialize to default on module load so server and client initial render match.
  language: DEFAULT_LANGUAGE,

  setLanguage: (language) => {
    const active = setUiTextLanguage(language);
    const scrollPositions =
      active === useLanguageStore.getState().language
        ? []
        : captureScrollPositions();
    persist(active);
    set({ language: active });
    restoreScrollPositions(scrollPositions);
    if (typeof document !== "undefined") {
      document.documentElement.lang = active;
    }
    return active;
  },
}));

// Hydration should be triggered from a central client-side entry (AppProviders) to avoid
// reading localStorage at module initialization which causes SSR/client mismatches.
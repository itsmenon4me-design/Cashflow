import { create } from "zustand";

export type ThemePreference = "light" | "dark";
type Mode = ThemePreference;

const STORAGE_KEY = "cashflow.theme";
const COOKIE_KEY = "cashflow.theme";
const DEFAULT_THEME: ThemePreference = "dark";
const INITIAL_THEME: ThemePreference =
  typeof document !== "undefined" && !document.documentElement.classList.contains("dark")
    ? "light"
    : DEFAULT_THEME;

function readCookieTheme(): ThemePreference | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_KEY}=([^;]*)`));
  const val = match ? decodeURIComponent(match[1]) : null;
  return val === "light" || val === "dark" ? val : null;
}

function readStored(): ThemePreference {
  const cookieVal = readCookieTheme();
  if (cookieVal) return cookieVal;
  if (typeof window === "undefined") return DEFAULT_THEME;
  const value = window.localStorage.getItem(STORAGE_KEY);
  if (value === "light" || value === "dark") return value;
  return DEFAULT_THEME;
}

function persist(theme: ThemePreference): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, theme);
    document.cookie = `${COOKIE_KEY}=${theme}; path=/; max-age=31536000; samesite=lax`;
  }
}

function sanitize(theme: ThemePreference): ThemePreference {
  return theme === "light" ? "light" : "dark";
}

interface ThemeState {
  theme: ThemePreference;
  mode: Mode;
  setTheme: (theme: ThemePreference) => void;
  toggleMode: () => void;
}

export function hydrateThemePreference(): ThemePreference {
  const stored = readStored();
  useThemeStore.setState({ theme: stored, mode: stored });
  try { if (typeof document !== 'undefined') document.documentElement.dataset.theme = stored; } catch (e) {}
  return stored;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  // Initialize to default / live DOM state to avoid theme flash during hydration.
  theme: INITIAL_THEME,
  mode: INITIAL_THEME,

  setTheme: (theme) => {
    const next = sanitize(theme);
    persist(next);
    set({ theme: next, mode: next });
  },

  toggleMode: () => {
    get().setTheme(get().mode === "dark" ? "light" : "dark");
  },
}));
import { create } from "zustand";

export type ThemePreference = "light" | "dark";
type Mode = ThemePreference;

const STORAGE_KEY = "cashflow.theme";
const DEFAULT_THEME: ThemePreference = "dark";

function readStored(): ThemePreference {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const value = window.localStorage.getItem(STORAGE_KEY);
  if (value === "light" || value === "dark") return value;
  return DEFAULT_THEME;
}

function persist(theme: ThemePreference): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, theme);
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
  // Initialize to default to avoid reading localStorage during SSR/module init.
  theme: DEFAULT_THEME,
  mode: DEFAULT_THEME,

  setTheme: (theme) => {
    const next = sanitize(theme);
    persist(next);
    set({ theme: next, mode: next });
  },

  toggleMode: () => {
    get().setTheme(get().mode === "dark" ? "light" : "dark");
  },
}));
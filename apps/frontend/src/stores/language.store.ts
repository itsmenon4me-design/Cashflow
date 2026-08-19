import { create } from "zustand";
import type { LanguagePreference } from "@/types/settings";
import { setUiTextLanguage } from "@/locales";

const STORAGE_KEY = "cashflow.language";
const DEFAULT_LANGUAGE: LanguagePreference = "id";

export function hydrateLanguagePreference(): LanguagePreference {
  const active = readStored();
  setUiTextLanguage(active);
  useLanguageStore.setState({ language: active });
  return active;
}

function readStored(): LanguagePreference {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === "en" ? "en" : DEFAULT_LANGUAGE;
}

function persist(language: LanguagePreference): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, language);
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
  language: readStored(),

  setLanguage: (language) => {
    const active = setUiTextLanguage(language);
    persist(active);
    set({ language: active });
    if (typeof document !== "undefined") {
      document.documentElement.lang = active;
    }
    return active;
  },
}));

if (typeof window !== "undefined") {
  hydrateLanguagePreference();
}
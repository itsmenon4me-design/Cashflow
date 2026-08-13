import type { LanguagePreference } from "@/types/settings";
import { enText } from "./en";
import { idText } from "./id";

export const locales = {
  id: idText,
  en: enText,
} as const;

type DeepStringify<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]>;
};

/** Structural type of the locale texts with string literals widened. */
export type LocaleText = DeepStringify<typeof idText>;

/**
 * Global UI text in the active language.
 *
 * `uiText` is an ES-module live binding: `setUiTextLanguage()` swaps the
 * underlying object so every component that reads `uiText.*` during render
 * picks up the new language. The language root swaps the binding and remounts
 * the app tree when the language changes, so static imports like
 * `import { uiText } from "@/locales"` reflect the persisted language instead
 * of being hardcoded to Indonesian.
 */
export let uiText: LocaleText = locales.id;

export function setUiTextLanguage(language?: LanguagePreference | string | null): LanguagePreference {
  const active: LanguagePreference = language === "en" ? "en" : "id";
  uiText = locales[active];
  return active;
}

export function getUiText(language?: LanguagePreference | string | null) {
  return language === "en" ? locales.en : locales.id;
}
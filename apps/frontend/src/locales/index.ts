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
 * Read the active language from the mirrored cookie. Works on both server and
 * client: `layout.tsx` (server) reads the same cookie via `next/headers`, and
 * on the client `document.cookie` carries the identical value, because
 * `persist()` in language.store mirrors every change into the cookie.
 */
export function readLanguageFromCookie(): LanguagePreference {
  if (typeof document === "undefined") return "id";
  try {
    const match = document.cookie.match(/(?:^|;\s*)cashflow\.language=(en|id)(?:;|$)/);
    if (match) return match[1] === "en" ? "en" : "id";
  } catch {}
  return "id";
}

/**
 * Global UI text in the active language.
 *
 * `uiText` is an ES-module live binding: `setUiTextLanguage()` swaps the
 * underlying object so every component that reads `uiText.*` during render
 * picks up the new language.
 *
 * CRITICAL for hydration: the initializer reads the SAME source the server
 * used during SSR (the `cashflow.language` cookie). This makes the FIRST
 * client render byte-identical to the server HTML even when the persisted
 * language is not the default "id". Previously the client always started at
 * `locales.id` and only swapped after mount, which produced a hydration
 * mismatch that made React discard the whole tree (white flash / raw-HTML
 * FOUC on navigation and refresh).
 */
export let uiText: LocaleText = locales[readLanguageFromCookie()];

export function setUiTextLanguage(language?: LanguagePreference | string | null): LanguagePreference {
  const active: LanguagePreference = language === "en" ? "en" : "id";
  uiText = locales[active];
  return active;
}

export function getUiText(language?: LanguagePreference | string | null) {
  return language === "en" ? locales.en : locales.id;
}
import { useSyncExternalStore } from "react";
import { getUiText, type LocaleText } from "@/locales";
import { useLanguageStore } from "@/stores/language.store";

/**
 * Returns the active UI text reactively.
 *
 * Subscribes to the language store so any component using this hook re-renders
 * when the preference changes — instead of only reading the binding on initial
 * load. The returned value is the shared `uiText` live binding that
 * `setUiTextLanguage()` swaps.
 */
export function useUiText(): LocaleText {
  const language = useSyncExternalStore(
    useLanguageStore.subscribe,
    () => useLanguageStore.getState().language,
    () => "id",
  );
  return getUiText(language);
}

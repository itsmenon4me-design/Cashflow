"use client";

import { useEffect, type ReactNode } from "react";
import {
  hasStoredLanguagePreference,
  useLanguageStore,
} from "@/stores/language.store";
import { useAuthStore } from "@/stores/auth.store";
import { settingsService } from "@/services/settings.service";

interface LanguageProviderProps {
  children: ReactNode;
}

/**
 * Global language root.
 *
 * Local preference wins over backend settings, and the keyed subtree updates
 * consumers of the shared locale bundle whenever the language changes.
 */
export function LanguageProvider({ children }: LanguageProviderProps) {
  const language = useLanguageStore((state) => state.language);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  // Reconcile with the authoritative backend settings once authenticated.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (hasStoredLanguagePreference()) return;
    const languageAtRequest = useLanguageStore.getState().language;
    let cancelled = false;
    void settingsService
      .getSettings()
      .then((settings) => {
        if (
          !cancelled &&
          settings.language &&
          useLanguageStore.getState().language === languageAtRequest
        ) {
          setLanguage(settings.language);
        }
      })
      .catch(() => {
        // Keep the persisted localStorage choice when settings are unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, setLanguage]);

  return (
    <div key={language} data-language={language} className="contents">
      {children}
    </div>
  );
}
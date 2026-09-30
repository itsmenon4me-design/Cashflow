"use client";

import { useEffect, type ReactNode } from "react";
import {
  hasStoredLanguagePreference,
  useLanguageStore,
} from "@/stores/language.store";
import { useAuthStore } from "@/stores/auth.store";
import {
  clearSettingsSession,
  getSettingsForSession,
} from "@/services/settings-session";

interface LanguageProviderProps {
  children: ReactNode;
}

/**
 * Global language root.
 *
 * Local preference wins over backend settings. The keyed subtree refreshes
 * consumers of the shared locale bundle when the language changes.
 */
export function LanguageProvider({ children }: LanguageProviderProps) {
  const language = useLanguageStore((state) => state.language);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const email = useAuthStore((state) => state.user?.email);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  // Reconcile with the authoritative backend settings once authenticated.
  useEffect(() => {
    if (!isAuthenticated) {
      clearSettingsSession();
      return;
    }
    if (hasStoredLanguagePreference()) return;
    const languageAtRequest = useLanguageStore.getState().language;
    const sessionKey = email?.trim().toLowerCase() || "authenticated";
    let cancelled = false;
    void getSettingsForSession(sessionKey)
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
  }, [email, isAuthenticated, setLanguage]);

  return (
    <div key={language} data-language={language} className="contents">
      {children}
    </div>
  );
}
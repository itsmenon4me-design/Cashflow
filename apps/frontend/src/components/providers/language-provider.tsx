"use client";

import { useEffect, type ReactNode } from "react";
import { useLanguageStore } from "@/stores/language.store";
import { useAuthStore } from "@/stores/auth.store";
import { settingsService } from "@/services/settings.service";

interface LanguageProviderProps {
  children: ReactNode;
}

/**
 * Global language root.
 *
 * Sources of truth, in order:
 * 1. localStorage (persisted choice) — applied synchronously on store
 *    creation, so the UI renders in the persisted language on first paint.
 * 2. backend settings (authoritative) — reconciled once for authenticated
 *    sessions.
 *
 * This provider subscribes to the language store so it re-renders when the
 * language changes without remounting the whole app tree. That keeps live user
 * state (header, auth session, dashboard widgets, etc.) intact while the text
 * bundle switches over to the new locale.
 */
export function LanguageProvider({ children }: LanguageProviderProps) {
  const language = useLanguageStore((state) => state.language);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  // Reconcile with the authoritative backend settings once authenticated.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    void settingsService
      .getSettings()
      .then((settings) => {
        if (!cancelled && settings.language) {
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

  return <div data-language={language} className="contents">{children}</div>;
}
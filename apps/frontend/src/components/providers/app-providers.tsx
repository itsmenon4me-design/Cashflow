"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { OfflineBanner } from "@/components/layout/offline-banner";
import { OfflineProvider } from "@/components/providers/offline-provider";
import { syncController } from "@/lib/offline/sync-client";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { PwaInstallPrompt } from "@/components/pwa/pwa-install-prompt";
import { ErrorBoundary } from "@/components/states/ErrorBoundary";
import { LanguageProvider } from "@/components/providers/language-provider";
import { useAuthStore } from "@/stores/auth.store";
import { hydrateLanguagePreference } from "@/stores/language.store";
import { hydrateThemePreference } from "@/stores/theme.store";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const router = useRouter();

useEffect(() => {
    const hydrateAuth = () => {
      try {
        useAuthStore.getState().hydrateFromStorage();
      } catch {
        // ignore
      }
    };

    hydrateAuth();

    // Hydrate other client-only preferences (language, theme)
    try {
      try { hydrateLanguagePreference(); } catch (e) { console.warn('[app-providers] hydrateLanguagePreference failed', e); }
      try { hydrateThemePreference(); } catch (e) { console.warn('[app-providers] hydrateThemePreference failed', e); }
    } catch (e) {}

    const handleClientRoute = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (typeof detail !== "string" || !detail.startsWith("/")) {
        return;
      }

      if (window.location.pathname !== detail) {
        router.replace(detail);
      }
    };

    window.addEventListener("cashflow:client-route", handleClientRoute);
    return () => {
      window.removeEventListener("cashflow:client-route", handleClientRoute);
    };
  }, [router]);

  // Attach syncController to window for diagnostics in staging E2E (temporary)
  try {
    if (typeof window !== 'undefined') {
      // If test helper exists, signal hydration via it; otherwise set the flag directly
      if (typeof (window as any).__app_signalHydrated === 'function') {
        try { (window as any).__app_signalHydrated(); } catch (e) {}
      } else {
        (window as any).__app_client_ready = true;
      }

      // If any code queued a pending client route before the app finished
      // hydrating (for example during an auth refresh failure), perform that
      // navigation now using the same client-route mechanism so it behaves
      // consistently with other in-app navigations.
      try {
        const pending = (window as any).__app_pending_client_route;
        if (typeof pending === 'string' && pending.startsWith('/')) {
          delete (window as any).__app_pending_client_route;
          window.dispatchEvent(new CustomEvent('cashflow:client-route', { detail: pending }));
        }
      } catch (e) {
        // ignore
      }

      if ((window as any).syncController === undefined) {
        (window as any).syncController = syncController;
      }
    }
  } catch (e) {}

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <OfflineProvider>
          <LanguageProvider>{children}</LanguageProvider>
        </OfflineProvider>
      </ThemeProvider>
      <OfflineBanner />
      <PwaInstallPrompt />
    </ErrorBoundary>
  );
}

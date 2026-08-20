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

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const router = useRouter();

  useEffect(() => {
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
      if ((window as any).syncController === undefined) {
        (window as any).syncController = syncController;
        console.log('[app-providers] attached syncController to window');
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
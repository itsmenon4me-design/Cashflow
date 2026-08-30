"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { OfflineBanner } from "@/components/layout/offline-banner";
import { OfflineProvider } from "@/components/providers/offline-provider";
import { syncController } from "@/lib/offline/sync-client";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { PwaInstallPrompt } from "@/components/pwa/pwa-install-prompt";
import { ErrorBoundary } from "@/components/states/ErrorBoundary";
import { LanguageProvider } from "@/components/providers/language-provider";
import { apiClient, ApiError } from "@/lib/axios";
import { getAccessToken } from "@/lib/auth-token";
import { useAuthStore } from "@/stores/auth.store";
import { hydrateLanguagePreference } from "@/stores/language.store";
import { hydrateThemePreference } from "@/stores/theme.store";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const router = useRouter();
  const [oauthWelcome, setOauthWelcome] = useState<string | null>(null);

  useEffect(() => {
    const hydrateAuth = () => {
      try {
        useAuthStore.getState().hydrateFromStorage();
      } catch {
        // ignore
      }
    };

    hydrateAuth();

    const pendingWelcome = window.sessionStorage.getItem(
      "cashflow.oauth-welcome",
    );
    if (pendingWelcome) {
      try {
        const parsed = JSON.parse(pendingWelcome) as {
          type?: string;
          name?: string;
        };
        if (parsed.type === "new") {
          setOauthWelcome(
            "Akun baru berhasil dibuat, selamat datang di CashFlow!",
          );
        } else if (parsed.type === "returning") {
          setOauthWelcome(
            `Selamat datang kembali, ${parsed.name || "Pengguna"}!`,
          );
        }
        window.sessionStorage.removeItem("cashflow.oauth-welcome");
      } catch {
        window.sessionStorage.removeItem("cashflow.oauth-welcome");
      }
    }

    const handleOAuthWelcome = (event: Event) => {
      const detail = (event as CustomEvent<{ type?: string; name?: string }>)
        .detail;
      if (detail?.type === "new") {
        setOauthWelcome(
          "Akun baru berhasil dibuat, selamat datang di CashFlow!",
        );
      } else if (detail?.type === "returning") {
        setOauthWelcome(
          `Selamat datang kembali, ${detail.name || "Pengguna"}!`,
        );
      }
    };
    window.addEventListener("cashflow:oauth-welcome", handleOAuthWelcome);

    if (getAccessToken()) {
      void apiClient
        .get<{
          success: boolean;
          data?: {
            id?: string;
            full_name?: string;
            name?: string;
            email?: string;
            has_manual_password?: boolean | null;
          };
        }>("/auth/me")
        .then((response) => {
          const profile = response.data;
          if (!profile) return;

          useAuthStore.getState().setUser({
            name: profile.full_name || profile.name || "Pengguna",
            email: profile.email || useAuthStore.getState().user?.email || "",
            has_manual_password: profile.has_manual_password ?? null,
          });
        })
        .catch((error: unknown) => {
          // Keep the locally cached profile for network failures. Auth errors are
          // handled by the existing API interceptor and redirect flow.
          if (error instanceof ApiError && error.status === 401) return;
          console.warn(
            "[app-providers] profile refresh failed; using cached user",
            error,
          );
        });
    }

    // Hydrate other client-only preferences (language, theme)
    try {
      try {
        hydrateLanguagePreference();
      } catch (e) {
        console.warn("[app-providers] hydrateLanguagePreference failed", e);
      }
      try {
        hydrateThemePreference();
      } catch (e) {
        console.warn("[app-providers] hydrateThemePreference failed", e);
      }
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
      window.removeEventListener("cashflow:oauth-welcome", handleOAuthWelcome);
    };
  }, [router]);

  useEffect(() => {
    if (!oauthWelcome) return;
    const timeout = window.setTimeout(() => setOauthWelcome(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [oauthWelcome]);

  // Attach syncController to window for diagnostics in staging E2E (temporary)
  try {
    if (typeof window !== "undefined") {
      // If test helper exists, signal hydration via it; otherwise set the flag directly
      if (typeof (window as any).__app_signalHydrated === "function") {
        try {
          (window as any).__app_signalHydrated();
        } catch (e) {}
      } else {
        (window as any).__app_client_ready = true;
      }

      // If any code queued a pending client route before the app finished
      // hydrating (for example during an auth refresh failure), perform that
      // navigation now using the same client-route mechanism so it behaves
      // consistently with other in-app navigations.
      try {
        const pending = (window as any).__app_pending_client_route;
        if (typeof pending === "string" && pending.startsWith("/")) {
          delete (window as any).__app_pending_client_route;
          window.dispatchEvent(
            new CustomEvent("cashflow:client-route", { detail: pending }),
          );
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
      {oauthWelcome && (
        <div
          role="status"
          className="fixed right-4 top-4 z-toast max-w-sm rounded-lg border border-border bg-card px-4 py-3 text-sm text-card-foreground shadow-lg"
        >
          {oauthWelcome}
        </div>
      )}
    </ErrorBoundary>
  );
}

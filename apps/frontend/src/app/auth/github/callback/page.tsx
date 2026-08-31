"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/axios";
import { clearAuthTokens, setAuthTokens } from "@/lib/auth-token";
import { useAuthStore } from "@/stores/auth.store";

export default function GithubOAuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const query = new URLSearchParams(window.location.search);
    const accessToken = query.get("accessToken");
    const refreshToken = query.get("refreshToken");
    const userEmail = query.get("userEmail");
    const welcome = query.get("welcome");

    if (!accessToken || !refreshToken) {
      router.replace("/login?oauth_error=github_auth_failed");
      return;
    }

    let cancelled = false;
    setAuthTokens(accessToken, refreshToken);
    void apiClient
      .get<{ success: boolean; data?: { full_name?: string; name?: string; email?: string } }>(
        "/auth/me",
      )
      .then((response) => {
        if (cancelled || !response.data) {
          if (!cancelled) {
            clearAuthTokens();
            setError("Profil pengguna tidak dapat diverifikasi.");
          }
          return;
        }
        const profile = response.data;
        const name = profile.full_name?.trim() || profile.name?.trim();
        if (!name) {
          clearAuthTokens();
          setError("Nama pengguna tidak tersedia dari server.");
          return;
        }
        useAuthStore.getState().loginSession({
          accessToken,
          refreshToken,
          user: { name, email: profile.email || userEmail || "" },
        });
        if (welcome === "new" || welcome === "returning") {
          const welcomeDetail = { type: welcome, name };
          window.sessionStorage.setItem("cashflow.oauth-welcome", JSON.stringify(welcomeDetail));
          window.dispatchEvent(new CustomEvent("cashflow:oauth-welcome", { detail: welcomeDetail }));
        }
        router.replace("/dashboard");
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          clearAuthTokens();
          setError("Profil pengguna tidak dapat diverifikasi. Silakan coba lagi.");
          console.error("[github-oauth-callback] profile verification failed", reason);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          {error || "Memverifikasi profil GitHub..."}
        </p>
        {error && (
          <button type="button" className="mt-4 underline" onClick={() => window.location.reload()}>
            Coba lagi
          </button>
        )}
      </div>
    </div>
  );
}

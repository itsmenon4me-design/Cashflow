"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";

export default function GoogleOAuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const query = new URLSearchParams(window.location.search);
    const accessToken = query.get("accessToken");
    const refreshToken = query.get("refreshToken");
    const userEmail = query.get("userEmail");
    const userName = query.get("userName");
    const welcome = query.get("welcome");

    if (!accessToken || !refreshToken) {
      router.replace("/login?oauth_error=google_auth_failed");
      return;
    }

    useAuthStore.getState().loginSession({
      accessToken,
      refreshToken,
      user: {
        name: userName?.trim() || "CashFlow User",
        email: userEmail || "",
      },
    });

    if (welcome === "new" || welcome === "returning") {
      const welcomeDetail = {
        type: welcome,
        name: userName?.trim() || "Pengguna",
      };
      window.sessionStorage.setItem(
        "cashflow.oauth-welcome",
        JSON.stringify(welcomeDetail),
      );
      window.dispatchEvent(
        new CustomEvent("cashflow:oauth-welcome", { detail: welcomeDetail }),
      );
    }
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Memproses login Google...
        </p>
      </div>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";

export default function AppleOAuthCallbackPage() {
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

    if (!accessToken || !refreshToken) {
      router.replace("/login?oauth_error=apple_auth_failed");
      return;
    }

    useAuthStore.getState().loginSession({
      accessToken,
      refreshToken,
      user: {
        name: userName || userEmail || "CashFlow User",
        email: userEmail || "",
      },
    });

    router.replace("/");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Memproses login Apple...</p>
      </div>
    </div>
  );
}

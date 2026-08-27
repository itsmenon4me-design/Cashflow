"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef } from "react";
import { ensureFreshAccessToken } from "@/lib/axios";
import { offlineScope } from "@/lib/offline/read-cache";
import { clearOfflineUserData } from "@/lib/offline/storage";
import { syncController } from "@/lib/offline/sync-client";
import { useAuthStore } from "@/stores/auth.store";
import { useSyncStore } from "@/stores/sync.store";
import { useDataRefreshStore } from "@/stores/refresh.store";

const FLUSH_INTERVAL_MS = 30_000;

export function OfflineProvider({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const email = useAuthStore((state) => state.user?.email);
  const previousScope = useRef<string>("");

  const handleOnline = useCallback(() => {
    useSyncStore.getState().setOnline(true);
    if (useAuthStore.getState().isAuthenticated) {
      void syncController.flush();
    }
  }, []);

  const handleOffline = useCallback(() => {
    useSyncStore.getState().setOnline(false);
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // Stable script URL: next.config serves /sw.js with no-cache headers, so the
    // browser's normal update check picks up new versions. A per-load cache-busting
    // query would reinstall + skipWaiting + claim on every navigation, which makes
    // the app behave like it is reloading itself.
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [handleOnline, handleOffline]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    // Fresh session (e.g. just logged back in): clear any stale
    // "session expired" notice before attempting to drain the queue.
    useSyncStore.getState().setNeedsReAuth(false);

    // Rotate a stale access token BEFORE syncing so queued operations don't
    // burn their first attempts on predictable 401s after being offline.
    const flushWithFreshToken = async () => {
      const stateBefore = useSyncStore.getState();
      const pendingBefore = stateBefore.pendingCount;
      let tokenFresh = true;
      try {
        tokenFresh = await ensureFreshAccessToken();
      } catch {
        // Refresh failures fall back to the normal 401 retry path per request.
        tokenFresh = false;
      }
      if (!tokenFresh && pendingBefore > 0) {
        // Session expired with pending offline work: make it VISIBLE instead
        // of silently letting transactions sit in the queue forever. The
        // items stay safely queued (scoped per user) until re-login, at which
        // point this effect re-runs and drains the queue.
        useSyncStore.getState().setNeedsReAuth(true);
      }
      await syncController.flush();
      const pendingAfter = useSyncStore.getState().pendingCount;
      if (pendingBefore > 0 && pendingAfter === 0) {
        // Queue drained: refetch authoritative state (balances are
        // server-authoritative; offline ops were applied on top of it).
        useDataRefreshStore.getState().bump();
      }
    };

    void flushWithFreshToken();
    const id = setInterval(() => {
      if (navigator.onLine) {
        void flushWithFreshToken();
      }
    }, FLUSH_INTERVAL_MS);
    return () => {
      clearInterval(id);
      // Never let a queued backoff timer fire after unmount / auth change.
      syncController.cancelScheduledRetry();
    };
  }, [isAuthenticated]);

  useEffect(() => {
    const current = offlineScope(email);
    const previous = previousScope.current;
    if (previous && previous !== current) {
      void clearOfflineUserData(previous);
      useSyncStore.getState().reset();
    }
    previousScope.current = current;
  }, [email]);

  return <>{children}</>;
}

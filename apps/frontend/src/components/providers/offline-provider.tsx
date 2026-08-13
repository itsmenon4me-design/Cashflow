"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef } from "react";
import { offlineScope } from "@/lib/offline/read-cache";
import { clearOfflineUserData } from "@/lib/offline/storage";
import { syncController } from "@/lib/offline/sync-client";
import { useAuthStore } from "@/stores/auth.store";
import { useSyncStore } from "@/stores/sync.store";

const FLUSH_INTERVAL_MS = 30_000;

export function OfflineProvider({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const email = useAuthStore((state) => state.user?.email);
  const previousScope = useRef<string>("");

  const handleOnline = useCallback(() => {
    useSyncStore.getState().setOnline(true);
    console.log('[offline-provider] online event received, isAuthenticated=', useAuthStore.getState().isAuthenticated);
    if (useAuthStore.getState().isAuthenticated) {
      console.log('[offline-provider] calling syncController.flush() on online');
      void syncController.flush();
    }
  }, []);

  const handleOffline = useCallback(() => {
    console.debug('[offline-provider] offline event received');
    useSyncStore.getState().setOnline(false);
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      return;
    }
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);

    // mark mounted for diagnostics
    try{ (window as any).__offline_provider_mounted = true; }catch(e){}

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    try{ (window as any).__offline_provider_listeners = { online: true, offline: true }; }catch(e){}
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      try{ (window as any).__offline_provider_listeners = { online: false, offline: false }; }catch(e){}
    };
  }, [handleOnline, handleOffline]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    void syncController.flush();
    const id = setInterval(() => {
      if (navigator.onLine) {
        void syncController.flush();
      }
    }, FLUSH_INTERVAL_MS);
    return () => clearInterval(id);
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
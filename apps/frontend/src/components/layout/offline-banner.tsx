"use client";

import { useEffect, useState } from "react";
import { CloudUpload, WifiOff } from "lucide-react";

import { uiText } from "@/locales";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useSyncStore } from "@/stores/sync.store";

export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();
  const pendingCount = useSyncStore((state) => state.pendingCount);
  const needsReAuth = useSyncStore((state) => state.needsReAuth);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!mounted) {
    return null;
  }

  // Session expired with pending offline work (user is back ONLINE but the
  // queue cannot drain): visible, actionable notice — never a silent fail.
  if (isOnline) {
    if (!needsReAuth || pendingCount === 0) {
      return null;
    }
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="fixed inset-x-0 top-0 z-toast flex items-center justify-center gap-2 bg-destructive/95 px-4 py-2 text-sm font-medium text-white backdrop-blur"
      >
        <CloudUpload className="size-4 shrink-0" aria-hidden="true" />
        <span>
          {uiText.states.sessionExpiredPendingSync.replace(
            "{count}",
            String(pendingCount),
          )}
        </span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-toast flex items-center justify-center gap-2 bg-warning/95 px-4 py-2 text-sm font-medium text-background backdrop-blur"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden="true" />
      <span>{uiText.states.offlineTitle}</span>
      {pendingCount > 0 && (
        <>
          <span className="hidden opacity-50 sm:inline">·</span>
          <span className="inline-flex items-center gap-1.5">
            <CloudUpload className="size-3.5 shrink-0" aria-hidden="true" />
            {uiText.states.offlinePendingCount.replace(
              "{count}",
              String(pendingCount),
            )}
          </span>
        </>
      )}
      <span className="hidden font-normal opacity-75 sm:inline">
        {uiText.states.offlineDescription}
      </span>
    </div>
  );
}

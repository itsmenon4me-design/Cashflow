"use client";

import { WifiOff } from "lucide-react";

import { uiText } from "@/locales";
import { useNetworkStatus } from "@/hooks/use-network-status";

export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-toast flex items-center justify-center gap-2 bg-warning/95 px-4 py-2 text-sm font-medium text-background backdrop-blur"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden="true" />
      <span>{uiText.states.offlineTitle}</span>
      <span className="hidden font-normal opacity-75 sm:inline">
        {uiText.states.offlineDescription}
      </span>
    </div>
  );
}
"use client";

import { useSyncStore } from "@/stores/sync.store";

export function useOnlineStatus(): { isOnline: boolean } {
  const isOnline = useSyncStore((state) => state.online);
  return { isOnline };
}
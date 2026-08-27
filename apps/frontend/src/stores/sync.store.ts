import { create } from "zustand";

export type SyncUiStatus =
  | "online"
  | "offline"
  | "syncing"
  | "synced"
  | "sync-failed";

interface SyncState {
  online: boolean;
  status: SyncUiStatus;
  pendingCount: number;
  failedCount: number;
  lastSyncedAt: number | null;
  /** Incremented whenever queue contents change — lets optimistic UI resync. */
  queueVersion: number;
  /**
   * Session expired while items were pending: the user must log back in for
   * the queue to drain. Surfaced as a visible notice, never a silent fail.
   */
  needsReAuth: boolean;
  /** Stable reason code for the first parked (failed) item, if any. */
  failedReason: string | null;
  setOnline: (online: boolean) => void;
  setStatus: (status: SyncUiStatus) => void;
  setPendingCount: (count: number) => void;
  setFailedCount: (count: number) => void;
  markSynced: () => void;
  bumpQueueVersion: () => void;
  setNeedsReAuth: (needsReAuth: boolean) => void;
  reset: () => void;
}

const initialState = {
  online: typeof window === "undefined" ? true : navigator.onLine,
  status: "online" as SyncUiStatus,
  pendingCount: 0,
  failedCount: 0,
  lastSyncedAt: null as number | null,
  queueVersion: 0,
  needsReAuth: false,
  failedReason: null as string | null,
};

export const useSyncStore = create<SyncState>((set) => ({
  ...initialState,
  setOnline: (online) =>
    set((state) => ({
      online,
      status: online ? state.status : "offline",
    })),
  setStatus: (status) => set({ status }),
  setPendingCount: (count) => set({ pendingCount: count }),
  setFailedCount: (count) => set({ failedCount: count }),
  markSynced: () =>
    set({ status: "synced", lastSyncedAt: Date.now(), needsReAuth: false, failedReason: null }),
  bumpQueueVersion: () =>
    set((state) => ({ queueVersion: state.queueVersion + 1 })),
  setNeedsReAuth: (needsReAuth) => set({ needsReAuth }),
  reset: () =>
    set((state) => ({ ...initialState, online: state.online })),
}));
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
  setOnline: (online: boolean) => void;
  setStatus: (status: SyncUiStatus) => void;
  setPendingCount: (count: number) => void;
  setFailedCount: (count: number) => void;
  markSynced: () => void;
  reset: () => void;
}

const initialState = {
  online: typeof window === "undefined" ? true : navigator.onLine,
  status: "online" as SyncUiStatus,
  pendingCount: 0,
  failedCount: 0,
  lastSyncedAt: null as number | null,
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
    set({ status: "synced", lastSyncedAt: Date.now() }),
  reset: () => set({ ...initialState }),
}));
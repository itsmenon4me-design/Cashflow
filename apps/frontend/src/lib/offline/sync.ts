export type SyncEntityType = "transaction" | "account" | "budget" | "goal" | "investment";

export type SyncAction = "create" | "update" | "delete";

export type SyncStatus = "idle" | "offline" | "syncing" | "synced" | "error";

export interface SyncQueueItem {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  action: SyncAction;
  payload: unknown;
  queuedAt: string;
}

export interface OfflineSyncConfig {
  queueKey: string;
  flushIntervalMs: number;
  maxRetries: number;
  storage: "localStorage" | "indexedDB";
}

export const DEFAULT_OFFLINE_SYNC_CONFIG: OfflineSyncConfig = {
  queueKey: "cashflow.sync.queue",
  flushIntervalMs: 30_000,
  maxRetries: 3,
  storage: "indexedDB",
};

export interface OfflineSyncController {
  readonly config: OfflineSyncConfig;
  readonly status: SyncStatus;
  enqueue(item: Omit<SyncQueueItem, "id" | "queuedAt">): Promise<void>;
  flush(): Promise<SyncStatus>;
  clear(): Promise<void>;
  getQueue(): Promise<SyncQueueItem[]>;
}

export function createOfflineSyncController(
  config: Partial<OfflineSyncConfig> = {}
): OfflineSyncController {
  const merged: OfflineSyncConfig = { ...DEFAULT_OFFLINE_SYNC_CONFIG, ...config };

  return {
    config: merged,
    status: "idle",
    async enqueue() {},
    async flush() {
      return "idle";
    },
    async clear() {},
    async getQueue() {
      return [];
    },
  };
}

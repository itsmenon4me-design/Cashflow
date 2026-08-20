import { IDB_STORES, idbDelete, idbGetAll, idbPut } from "@/lib/offline/idb";
import { offlineScope } from "@/lib/offline/read-cache";
import { useSyncStore, type SyncUiStatus } from "@/stores/sync.store";

const QUEUE_ID_PREFIX = "cfg";

export type SyncEntityType =
  | "transaction"
  | "account"
  | "budget"
  | "goal"
  | "investment";

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

export interface SyncQueueRecord extends SyncQueueItem {
  scope: string;
  retries: number;
  failed: boolean;
  lastError?: string;
}

export type SyncErrorKind = "transient" | "conflict";

export class SyncError extends Error {
  readonly kind: SyncErrorKind;

  constructor(kind: SyncErrorKind, message: string) {
    super(message);
    this.name = "SyncError";
    this.kind = kind;
  }
}

export interface OfflineSyncConfig {
  queueKey: string;
  flushIntervalMs: number;
  maxRetries: number;
  storage: "localStorage" | "indexedDB";
  scope: () => string;
  executor: (item: SyncQueueItem) => Promise<void>;
}

export const DEFAULT_OFFLINE_SYNC_CONFIG: Omit<OfflineSyncConfig, "scope" | "executor"> = {
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
  getPendingCount(): Promise<number>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function isOnline(): boolean {
  return typeof window === "undefined" ? true : navigator.onLine;
}

function toSyncStatus(status: SyncUiStatus): SyncStatus {
  switch (status) {
    case "syncing":
      return "syncing";
    case "synced":
      return "synced";
    case "sync-failed":
      return "error";
    case "offline":
      return "offline";
    default:
      return "idle";
  }
}

async function recordsFor(scope: string): Promise<SyncQueueRecord[]> {
  const all = await idbGetAll<SyncQueueRecord>(IDB_STORES.SYNC_QUEUE);
  const wanted = offlineScope(scope);
  return all.filter((record) => String(record.scope || '').toLowerCase().trim() === wanted);
}

async function refreshCounters(scope: string): Promise<void> {
  const records = await recordsFor(scope);
  useSyncStore.setState({
    pendingCount: records.filter((record) => !record.failed).length,
    failedCount: records.filter((record) => record.failed).length,
  });
}

export function createOfflineSyncController(
  config: {
    scope: () => string;
    executor: (item: SyncQueueItem) => Promise<void>;
  } & Partial<OfflineSyncConfig>,
): OfflineSyncController {
  const merged: OfflineSyncConfig = {
    ...DEFAULT_OFFLINE_SYNC_CONFIG,
    ...config,
    scope: config.scope,
    executor: config.executor,
  };

  let isFlushing = false;

  return {
    config: merged,
    get status(): SyncStatus {
      return toSyncStatus(useSyncStore.getState().status);
    },
    async enqueue(item) {
      const scopeRaw = merged.scope() || offlineScope();
      const scope = offlineScope(scopeRaw);
      if (!scope) {
        return;
      }
      const records = await recordsFor(scope);
      if (item.action === "delete") {
        const pendingCreate = records.find(
          (record) => record.action === "create" && record.entityId === item.entityId,
        );
        if (pendingCreate) {
          await idbDelete(IDB_STORES.SYNC_QUEUE, pendingCreate.id);
          await refreshCounters(scope);
          return;
        }
      }
      if (item.action === "update") {
        const pendingCreate = records.find(
          (record) => record.action === "create" && record.entityId === item.entityId,
        );
        if (pendingCreate) {
          pendingCreate.payload = {
            ...(pendingCreate.payload as object),
            ...(item.payload as object),
          };
          await idbPut(IDB_STORES.SYNC_QUEUE, pendingCreate);
          await refreshCounters(scope);
          return;
        }
      }
      const uuid =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const record: SyncQueueRecord = {
        id: `${QUEUE_ID_PREFIX}:${scope}:${uuid}`,
        scope,
        entityType: item.entityType,
        entityId: item.entityId,
        action: item.action,
        payload: item.payload,
        queuedAt: nowIso(),
        retries: 0,
        failed: false,
      };
      await idbPut(IDB_STORES.SYNC_QUEUE, record);
      await refreshCounters(scope);
    },

    async flush() {
      if (isFlushing) {
        console.log('[sync] flush() already running, skipping');
        return toSyncStatus(useSyncStore.getState().status);
      }
      isFlushing = true;
      try {
        const scope = merged.scope() || offlineScope();
        console.log('[sync] flush() called, computed scope:', scope, 'navigator.onLine=', typeof navigator !== 'undefined' ? navigator.onLine : 'n/a');
        if (!scope) {
          console.debug('[sync] flush() abort: no scope');
          return "idle";
        }
        if (!isOnline()) {
          console.debug('[sync] flush() abort: offline, refreshing counters');
          await refreshCounters(scope);
          return "offline";
        }
        const pending = (await recordsFor(scope)).filter((record) => !record.failed);
        const failedCount = (await recordsFor(scope)).filter((record) => record.failed).length;
        console.log('[sync] flush() scope=', scope, 'pending=', pending.length, 'failedCount=', failedCount);
        if (pending.length === 0) {
          if (failedCount > 0) {
            useSyncStore.setState({ status: "sync-failed", failedCount });
          } else {
            useSyncStore.getState().markSynced();
          }
          console.log('[sync] flush() nothing to do, status=', useSyncStore.getState().status);
          return toSyncStatus(useSyncStore.getState().status);
        }

        useSyncStore.setState({ status: "syncing", pendingCount: pending.length });

        for (const item of pending) {
          console.log('[sync] flushing item', item.id, 'action=', item.action, 'entityId=', item.entityId);
          try {
            await merged.executor(item);
            console.log('[sync] executor succeeded for', item.id, 'deleting from idb');
            await idbDelete(IDB_STORES.SYNC_QUEUE, item.id);
          } catch (err) {
            console.log('[sync] executor failed for', item.id, 'error=', err instanceof Error ? err.message : String(err));
            const kind = err instanceof SyncError ? err.kind : ("transient" as SyncErrorKind);
            item.retries += 1;
            item.lastError = err instanceof Error ? err.message : String(err);
            if (kind === "conflict" || item.retries > merged.maxRetries) {
              item.failed = true;
            }
            await idbPut(IDB_STORES.SYNC_QUEUE, item);
          }
        }

        const after = await recordsFor(scope);
        const remainingPending = after.filter((record) => !record.failed).length;
        const remainingFailed = after.filter((record) => record.failed).length;
        useSyncStore.setState({
          pendingCount: remainingPending,
          failedCount: remainingFailed,
        });

        console.log('[sync] flush() completed, remainingPending=', remainingPending, 'remainingFailed=', remainingFailed);

        if (remainingPending === 0 && remainingFailed === 0) {
          useSyncStore.getState().markSynced();
        } else if (remainingPending === 0) {
          useSyncStore.setState({ status: "sync-failed" });
        } else {
          useSyncStore.setState({ status: "syncing" });
        }

        return toSyncStatus(useSyncStore.getState().status);
      } finally {
        isFlushing = false;
      }
    },


    async clear() {
      const scope = merged.scope() || offlineScope();
      if (!scope) {
        return;
      }
      const records = await recordsFor(scope);
      await Promise.all(
        records.map((record) =>
          idbDelete(IDB_STORES.SYNC_QUEUE, record.id),
        ),
      );
      await refreshCounters(scope);
      useSyncStore.setState({ status: "online", pendingCount: 0, failedCount: 0 });
    },
    async getQueue() {
      const scope = merged.scope() || offlineScope();
      const records = await recordsFor(scope);
      return records.filter((record) => !record.failed);
    },
    async getPendingCount() {
      const scope = merged.scope() || offlineScope();
      const records = await recordsFor(scope);
      return records.filter((record) => !record.failed).length;
    },
  };
}
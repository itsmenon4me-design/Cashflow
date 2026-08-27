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
  /** Epoch ms before which this item must not be retried (backoff window). */
  nextAttemptAt?: number;
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

// Exponential backoff between attempts: 1s, 2s, 4s, ... capped at 60s.
export const RETRY_BACKOFF_BASE_MS = 1_000;
const RETRY_BACKOFF_CAP_MS = 60_000;

export function backoffDelayMs(retries: number): number {
  const delay = RETRY_BACKOFF_BASE_MS * Math.pow(2, Math.max(0, retries - 1));
  return Math.min(delay, RETRY_BACKOFF_CAP_MS);
}

export interface OfflineSyncController {
  readonly config: OfflineSyncConfig;
  readonly status: SyncStatus;
  enqueue(item: Omit<SyncQueueItem, "id" | "queuedAt">): Promise<void>;
  flush(): Promise<SyncStatus>;
  clear(): Promise<void>;
  getQueue(): Promise<SyncQueueRecord[]>;
  getPendingCount(): Promise<number>;
  /** Cancels a pending backoff retry timer (unmount / scope change safety). */
  cancelScheduledRetry(): void;
  /**
   * Permanently removes ALL parked (failed) queue records for the current
   * scope. PURELY LOCAL: no server request is ever made — failed items are
   * final (e.g. deleted elsewhere / invalid), this only cleans local residue.
   * Returns how many records were removed.
   */
  dismissFailed(): Promise<number>;
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
  // FIFO: process in enqueue order (queuedAt), NOT IndexedDB key order —
  // keys contain random UUIDs which would shuffle the order otherwise.
  const wanted = offlineScope(scope);
  return all
    .filter((record) => String(record.scope || '').toLowerCase().trim() === wanted)
    .sort((a, b) => {
      const ta = Date.parse(a.queuedAt);
      const tb = Date.parse(b.queuedAt);
      if (ta !== tb) {
        return ta - tb;
      }
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}

async function refreshCounters(scope: string): Promise<void> {
  const records = await recordsFor(scope);
  useSyncStore.setState({
    pendingCount: records.filter((record) => !record.failed).length,
    failedCount: records.filter((record) => record.failed).length,
  });
  // Notify subscribers (optimistic UI) that queue contents changed.
  useSyncStore.getState().bumpQueueVersion();
}

/**
 * Cancel-out chains that never reached the server: if an entity was created
 * offline (temp id) and later deleted offline — with any number of edits in
 * between, all merged into the create record — the net server effect is
 * NOTHING. Remove every queued record for such entities so flushing sends
 * zero requests for them (the server never needs to learn they existed).
 *
 * Returns the list of collapsed entity ids (for logging/tests).
 */
export async function collapseCancelledChains(
  records: SyncQueueRecord[],
): Promise<string[]> {
  const createdOffline = new Set<string>();
  const deletedOffline = new Set<string>();
  for (const record of records) {
    if (record.action === "create") {
      createdOffline.add(record.entityId);
    } else if (record.action === "delete") {
      deletedOffline.add(record.entityId);
    }
  }
  const cancelled = [...createdOffline].filter((id) => deletedOffline.has(id));
  if (cancelled.length === 0) {
    return [];
  }
  const cancelledSet = new Set(cancelled);
  await Promise.all(
    records
      .filter((record) => cancelledSet.has(record.entityId))
      .map((record) => idbDelete(IDB_STORES.SYNC_QUEUE, record.id)),
  );
  return cancelled;
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
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  function cancelScheduledRetry(): void {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  function scheduleRetry(): void {
    cancelScheduledRetry();
    void (async () => {
      const scope = merged.scope() || offlineScope();
      if (!scope) {
        return;
      }
      const records = await recordsFor(scope);
      const dueDelays = records
        .filter((record) => !record.failed && record.nextAttemptAt)
        .map((record) => Math.max(0, (record.nextAttemptAt ?? 0) - Date.now()));
      if (dueDelays.length === 0) {
        return;
      }
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void controller.flush();
      }, Math.min(...dueDelays));
    })();
  }

  const controller: OfflineSyncController = {
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
        return toSyncStatus(useSyncStore.getState().status);
      }
      isFlushing = true;
      try {
        const scope = merged.scope() || offlineScope();
        if (!scope) {
          return "idle";
        }
        if (!isOnline()) {
          await refreshCounters(scope);
          return "offline";
        }

        // Server-authoritative conflict handling: the queue only ever sends
        // create/update/delete operations — balances are recomputed server-side
        // on top of the latest state, never overwritten from the client. After
        // the flush the entity caches are invalidated so every page refetches
        // the authoritative snapshot.
        let all = await recordsFor(scope);

        // Collapse create→edit→delete chains first: entities created AND
        // deleted entirely offline never existed server-side, so flush must
        // send ZERO requests for them.
        const collapsed = await collapseCancelledChains(all);
        if (collapsed.length > 0) {
          all = await recordsFor(scope);
        }

        const now = Date.now();
        // FIFO: only items whose backoff window has elapsed are processed;
        // the rest stay pending and get retried by scheduleRetry().
        const pending = all.filter(
          (record) => !record.failed && (record.nextAttemptAt ?? 0) <= now,
        );
        const failedCount = all.filter((record) => record.failed).length;
        const deferredCount = all.length - pending.length - failedCount;

        if (pending.length === 0) {
          await refreshCounters(scope);
          if (deferredCount > 0) {
            useSyncStore.setState({ status: "syncing" });
            scheduleRetry();
          } else if (failedCount > 0) {
            useSyncStore.setState({ status: "sync-failed", failedCount });
          } else {
            useSyncStore.getState().markSynced();
          }
          return toSyncStatus(useSyncStore.getState().status);
        }

        useSyncStore.setState({
          status: "syncing",
          pendingCount: pending.length + deferredCount,
        });

        for (const item of pending) {
          try {
            await merged.executor(item);
            await idbDelete(IDB_STORES.SYNC_QUEUE, item.id);
          } catch (err) {
            const kind = err instanceof SyncError ? err.kind : ("transient" as SyncErrorKind);
            item.retries += 1;
            item.lastError = err instanceof Error ? err.message : String(err);
            if (kind === "conflict" || item.retries > merged.maxRetries) {
              // Conflict / exhausted retries: park the item so it stops
              // blocking FIFO items behind it (it is surfaced as "sync
              // failed" in the UI instead of being retried forever).
              item.failed = true;
              item.nextAttemptAt = undefined;
            } else {
              // Exponential backoff before the next attempt.
              item.nextAttemptAt = Date.now() + backoffDelayMs(item.retries);
            }
            await idbPut(IDB_STORES.SYNC_QUEUE, item);
          }
        }

        await refreshCounters(scope);

        const after = await recordsFor(scope);
        const remainingPending = after.filter((record) => !record.failed).length;
        const remainingFailed = after.filter((record) => record.failed).length;
        // First parked item's stable error code (e.g. DELETED_ELSEWHERE) for
        // the UI to render a specific, actionable message.
        const failedReason =
          after.find((record) => record.failed)?.lastError ?? null;

        if (remainingPending === 0 && remainingFailed === 0) {
          useSyncStore.getState().markSynced();
        } else if (remainingPending > 0 && after.some((r) => !r.failed && (r.nextAttemptAt ?? 0) > Date.now())) {
          // Some items hit their transient-error backoff window.
          useSyncStore.setState({ status: "syncing", pendingCount: remainingPending, failedCount: remainingFailed, failedReason });
          scheduleRetry();
        } else if (remainingPending > 0) {
          useSyncStore.setState({ status: "syncing", pendingCount: remainingPending, failedCount: remainingFailed, failedReason });
        } else {
          useSyncStore.setState({ status: "sync-failed", failedCount: remainingFailed, failedReason });
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
      cancelScheduledRetry();
      useSyncStore.setState({
        status: "online",
        pendingCount: 0,
        failedCount: 0,
        failedReason: null,
        needsReAuth: false,
      });
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
    cancelScheduledRetry,

    async dismissFailed() {
      const scope = merged.scope() || offlineScope();
      if (!scope) {
        return 0;
      }
      // Stop any retry timer first so it cannot resurrect counters mid-clean.
      cancelScheduledRetry();
      const records = await recordsFor(scope);
      const failed = records.filter((record) => record.failed);
      await Promise.all(
        failed.map((record) => idbDelete(IDB_STORES.SYNC_QUEUE, record.id)),
      );
      await refreshCounters(scope);

      const remaining = useSyncStore.getState().pendingCount;
      if (remaining === 0) {
        useSyncStore.getState().markSynced();
      } else {
        useSyncStore.setState({
          status: "syncing",
          failedCount: 0,
          failedReason: null,
        });
        scheduleRetry();
      }
      return failed.length;
    },
  };

  return controller;
}
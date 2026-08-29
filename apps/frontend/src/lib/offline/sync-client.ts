import { ApiError } from "@/lib/axios";
import { offlineScope } from "@/lib/offline/read-cache";
import { clearCachedEntity, getCachedData, setCachedData } from "@/lib/offline/storage";
import {
  createOfflineSyncController,
  SyncError,
  type SyncQueueItem,
  type SyncQueueRecord,
} from "@/lib/offline/sync";
import {
  transactionService,
  type CreateTransactionPayload,
  type UpdateTransactionPayload,
} from "@/services/transaction.service";
import { isoToInputDate } from "@/lib/date";
import { toMajorUnits } from "@/lib/money";
import type { TransactionItem } from "@/types/dashboard";
import { useAuthStore } from "@/stores/auth.store";

const TRANSACTIONS_ENTITY = "transactions" as const;

function randomUuid(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Temporary client-side ID for offline-created entities (`temp_${uuid}`). */
export function makeTempId(): string {
  return `temp_${randomUuid()}`;
}

/** Stable error codes persisted with queued items and surfaced in the UI. */
export const SYNC_ERROR_CODES = {
  /** Update/delete hit a 404: the row was deleted elsewhere while we were offline. */
  DELETED_ELSEWHERE: "DELETED_ELSEWHERE",
} as const;

function isConflict(err: unknown): boolean {
  return err instanceof ApiError && err.status >= 400 && err.status < 500;
}

/** 404 on update/delete => the entity no longer exists server-side. */
function isDeletedElsewhere(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}

async function invalidateTransactionsCache(): Promise<void> {
  const scope = offlineScope();
  if (scope) {
    await clearCachedEntity(scope, TRANSACTIONS_ENTITY);
  }
}

/**
 * Persist the temp_id -> server_id replacement so the optimistic row shown
 * while offline can be reconciled against the real server record after a
 * successful sync (the server ID replaces the temporary one).
 */
async function rememberServerId(tempId: string, serverId: string): Promise<void> {
  const scope = offlineScope();
  if (!scope) {
    return;
  }
  await setCachedData(scope, TRANSACTIONS_ENTITY, `idmap:${tempId}`, serverId);
}

export async function resolveServerId(tempId: string): Promise<string | undefined> {
  const scope = offlineScope();
  if (!scope) {
    return undefined;
  }
  return getCachedData<string>(scope, TRANSACTIONS_ENTITY, `idmap:${tempId}`);
}

async function executor(item: SyncQueueItem): Promise<void> {
  let createdServerId: string | undefined;
  try {
    switch (item.action) {
      case "create": {
        const created = await transactionService.create(
          item.payload as CreateTransactionPayload,
        );
        // Replace the temporary ID with the authoritative server ID.
        createdServerId = created.id;
        break;
      }
      case "update":
        await transactionService.update(item.entityId, item.payload as UpdateTransactionPayload);
        break;
      case "delete":
        await transactionService.remove(item.entityId);
        break;
      default:
        throw new SyncError("transient", "Unsupported sync operation");
    }
    // Cache invalidation is BEST-EFFORT: the server write already succeeded,
    // so an invalidation hiccup must not turn into a retry (which could
    // duplicate work for backends without idempotency keys).
    try {
      await invalidateTransactionsCache();
    } catch {
      // ignore — next successful fetch repopulates the cache anyway.
    }
    // IMPORTANT: record the temp->server replacement AFTER the cache
    // invalidation above — clearCachedEntity() wipes everything under
    // `cfg:{scope}:transactions:` including the mapping itself.
    if (createdServerId !== undefined && item.action === "create") {
      await rememberServerId(item.entityId, createdServerId);
    }
  } catch (err) {
    if (err instanceof SyncError) {
      throw err;
    }
    // Edit/delete raced with a delete from another device/tab: surface a
    // clear, actionable state instead of silently resurrecting or failing.
    if (
      isDeletedElsewhere(err) &&
      (item.action === "update" || item.action === "delete")
    ) {
      throw new SyncError("conflict", SYNC_ERROR_CODES.DELETED_ELSEWHERE);
    }
    if (isConflict(err)) {
      throw new SyncError(
        "conflict",
        err instanceof Error ? err.message : "Conflict",
      );
    }
    throw new SyncError(
      "transient",
      err instanceof Error ? err.message : String(err),
    );
  }
}

export const syncController = createOfflineSyncController({
  scope: () => useAuthStore.getState().user?.email ?? "",
  executor,
});

// Attach for diagnostics in staging runs so E2E can call flush() directly.
if (typeof window !== "undefined") {
  try {
    (window as any).syncController = syncController;
  } catch {
    // ignore
  }
}

export interface TransactionMutationResult {
  queued: boolean;
  id?: string;
}

export async function syncCreateTransaction(
  payload: CreateTransactionPayload,
): Promise<TransactionMutationResult> {
  const tempId = makeTempId();
  const body = { ...payload, reference_number: tempId };

  if (typeof window === "undefined" || !navigator.onLine) {
    await syncController.enqueue({
      entityType: "transaction",
      entityId: tempId,
      action: "create",
      payload: body,
    });
    return { queued: true, id: tempId };
  }

  try {
    const created = await transactionService.create(body);
    await invalidateTransactionsCache();
    return { queued: false, id: created.id };
  } catch (err) {
    if (isConflict(err)) {
      throw err;
    }
    await syncController.enqueue({
      entityType: "transaction",
      entityId: tempId,
      action: "create",
      payload: body,
    });
    return { queued: true, id: tempId };
  }
}

export async function syncUpdateTransaction(
  id: string,
  payload: UpdateTransactionPayload,
): Promise<TransactionMutationResult> {
  if (typeof window === "undefined" || !navigator.onLine) {
    await syncController.enqueue({
      entityType: "transaction",
      entityId: id,
      action: "update",
      payload,
    });
    return { queued: true };
  }

  try {
    await transactionService.update(id, payload);
    await invalidateTransactionsCache();
    return { queued: false };
  } catch (err) {
    if (isConflict(err)) {
      throw err;
    }
    await syncController.enqueue({
      entityType: "transaction",
      entityId: id,
      action: "update",
      payload,
    });
    return { queued: true };
  }
}

export async function syncDeleteTransaction(
  id: string,
): Promise<TransactionMutationResult> {
  if (typeof window === "undefined" || !navigator.onLine) {
    await syncController.enqueue({
      entityType: "transaction",
      entityId: id,
      action: "delete",
      payload: { id },
    });
    return { queued: true };
  }

  try {
    await transactionService.remove(id);
    await invalidateTransactionsCache();
    return { queued: false };
  } catch (err) {
    if (isConflict(err)) {
      throw err;
    }
    await syncController.enqueue({
      entityType: "transaction",
      entityId: id,
      action: "delete",
      payload: { id },
    });
    return { queued: true };
  }
}

// ---------------------------------------------------------------------------
// Optimistic UI helpers
// ---------------------------------------------------------------------------

/** Queued transactions for the current user scope (pending_sync state). */
export async function getPendingTransactionRecords(): Promise<SyncQueueRecord[]> {
  const queue: SyncQueueRecord[] = await syncController.getQueue();
  return queue.filter((item) => item.entityType === "transaction");
}

/**
 * Convert a queued create payload into a displayable TransactionItem so an
 * offline-created transaction shows up in lists immediately (optimistic UI).
 * Amounts are converted back to major units using the target account currency.
 */
export async function pendingRecordsToItems(
  categoryNames: Record<string, string>,
): Promise<TransactionItem[]> {
  const records = await getPendingTransactionRecords();
  const items: TransactionItem[] = [];
  for (const record of records) {
    if (record.action !== "create") {
      continue;
    }
    const payload = record.payload as CreateTransactionPayload & {
      reference_number?: string;
    };
    if (!payload) {
      continue;
    }
    items.push({
      id: record.entityId,
      date: isoToInputDate(payload.transaction_date),
      dateTime: payload.transaction_date,
      category: categoryNames[payload.category_id] ?? "-",
      description: payload.note ?? "",
      amount: toMajorUnits(BigInt(payload.amount_cents), "IDR"),
      type: payload.transaction_type === "INCOME" ? "income" : "expense",
      status: "completed",
      note: payload.note ?? undefined,
      pendingSync: true,
    });
  }
  return items;
}

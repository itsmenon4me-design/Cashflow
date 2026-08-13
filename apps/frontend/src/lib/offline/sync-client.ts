import { ApiError } from "@/lib/axios";
import { offlineScope } from "@/lib/offline/read-cache";
import { clearCachedEntity } from "@/lib/offline/storage";
import {
  createOfflineSyncController,
  SyncError,
  type SyncQueueItem,
} from "@/lib/offline/sync";
import {
  transactionService,
  type CreateTransactionPayload,
  type UpdateTransactionPayload,
} from "@/services/transaction.service";
import { useAuthStore } from "@/stores/auth.store";

const TRANSACTIONS_ENTITY = "transactions" as const;

function randomUuid(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isConflict(err: unknown): boolean {
  return err instanceof ApiError && err.status >= 400 && err.status < 500;
}

async function invalidateTransactionsCache(): Promise<void> {
  const scope = offlineScope();
  if (scope) {
    await clearCachedEntity(scope, TRANSACTIONS_ENTITY);
  }
}

async function executor(item: SyncQueueItem): Promise<void> {
  try {
    switch (item.action) {
      case "create":
        await transactionService.create(item.payload as CreateTransactionPayload);
        break;
      case "update":
        await transactionService.update(
          item.entityId,
          item.payload as UpdateTransactionPayload,
        );
        break;
      case "delete":
        await transactionService.remove(item.entityId);
        break;
      default:
        throw new SyncError("transient", "Unsupported sync operation");
    }
    await invalidateTransactionsCache();
  } catch (err) {
    if (err instanceof SyncError) {
      throw err;
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

// Attach for diagnostics in staging runs (temporary): expose to window so E2E can call flush()
if (typeof window !== "undefined") {
  try {
    (window as any).syncController = syncController;
    console.log('[sync-client] syncController attached to window for diagnostics');
  } catch (e) {
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
  const referenceNumber = randomUuid();
  const body = { ...payload, reference_number: referenceNumber };

  if (typeof navigator === "undefined" || !navigator.onLine) {
    await syncController.enqueue({
      entityType: "transaction",
      entityId: referenceNumber,
      action: "create",
      payload: body,
    });
    return { queued: true };
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
      entityId: referenceNumber,
      action: "create",
      payload: body,
    });
    return { queued: true };
  }
}

export async function syncUpdateTransaction(
  id: string,
  payload: UpdateTransactionPayload,
): Promise<TransactionMutationResult> {
  if (typeof navigator === "undefined" || !navigator.onLine) {
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
  if (typeof navigator === "undefined" || !navigator.onLine) {
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
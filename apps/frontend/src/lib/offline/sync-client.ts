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
import { useDashboardCurrencyStore } from "@/stores/dashboardCurrency.store";

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
        await transactionService.create(item.payload as CreateTransactionPayload, useDashboardCurrencyStore.getState().currency);
        break;
      case "update":
        await transactionService.update(
          item.entityId,
          item.payload as UpdateTransactionPayload,
          useDashboardCurrencyStore.getState().currency,
        );
        break;
      case "delete":
        await transactionService.remove(item.entityId, useDashboardCurrencyStore.getState().currency);
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

  if (typeof window === "undefined" || !navigator.onLine) {
    await syncController.enqueue({
      entityType: "transaction",
      entityId: referenceNumber,
      action: "create",
      payload: body,
    });
    return { queued: true };
  }

  try {
    // Defensive: if UI route implies a forced transaction type (incomes/expenses pages), ensure payload matches
    try {
      if (typeof window !== 'undefined') {
        // Prefer explicit session flag set by TransactionForm when opened
        const pending = sessionStorage.getItem('cashflow.pendingCreateType');
        if (pending) {
          const normalized = pending.toLowerCase();
          (body as any).transaction_type = normalized === 'income' ? 'INCOME' : 'EXPENSE';
          sessionStorage.removeItem('cashflow.pendingCreateType');
        } else {
          const p = window.location.pathname || '';
          if (p.startsWith('/incomes')) {
            (body as any).transaction_type = 'INCOME';
          } else if (p.startsWith('/expenses')) {
            (body as any).transaction_type = 'EXPENSE';
          }
        }
      }
    } catch (e) {
      // ignore
    }

    const created = await transactionService.create(body, useDashboardCurrencyStore.getState().currency);
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
    await transactionService.update(id, payload, useDashboardCurrencyStore.getState().currency);
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
  // TEMP DIAG: log initial state
  try {
    console.log('[DELETE FLOW] syncDeleteTransaction called id=', id, 'navigator.onLine=', typeof navigator !== 'undefined' ? navigator.onLine : 'no-navigator');
  } catch (e) {}

  if (typeof window === "undefined" || !navigator.onLine) {
    try {
      console.log('[DELETE FLOW] offline branch - enqueue delete id=', id);
    } catch (e) {}
    await syncController.enqueue({
      entityType: "transaction",
      entityId: id,
      action: "delete",
      payload: { id },
    });
    try {
      console.log('[DELETE FLOW] enqueue completed for id=', id);
    } catch (e) {}
    return { queued: true };
  }

  try {
    try {
      console.log('[DELETE FLOW] online branch - calling transactionService.remove id=', id, 'currency=', useDashboardCurrencyStore.getState().currency);
    } catch (e) {}
    const res = await transactionService.remove(id, useDashboardCurrencyStore.getState().currency);
    try {
      console.log('[DELETE FLOW] transactionService.remove resolved for id=', id, 'response=', res);
    } catch (e) {}
    await invalidateTransactionsCache();
    return { queued: false };
  } catch (err) {
    try {
      console.error('[DELETE FLOW] transactionService.remove error id=', id, 'error=', err);
    } catch (e) {}
    if (isConflict(err)) {
      throw err;
    }
    try {
      console.log('[DELETE FLOW] enqueue after error id=', id);
    } catch (e) {}
    await syncController.enqueue({
      entityType: "transaction",
      entityId: id,
      action: "delete",
      payload: { id },
    });
    return { queued: true };
  }
}
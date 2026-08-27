"use client";

import { useEffect, useState } from "react";

import {
  getPendingTransactionRecords,
  pendingRecordsToItems,
} from "@/lib/offline/sync-client";
import type { TransactionItem } from "@/types/dashboard";
import { useSyncStore } from "@/stores/sync.store";

interface PendingTransactionsState {
  /** Queued offline-created transactions, ready to render optimistically. */
  items: TransactionItem[];
  /**
   * Entity IDs with ANY queued action (create/update/delete) so existing rows
   * can be flagged as "not synced yet" while offline.
   */
  pendingIds: ReadonlySet<string>;
}

const EMPTY: PendingTransactionsState = { items: [], pendingIds: new Set() };

/**
 * Subscribes to the sync queue (via queueVersion) and exposes the queued
 * transactions so lists can merge them into the rendered rows immediately.
 * Re-reads whenever connectivity flips because enqueue/flush paths differ.
 */
export function usePendingTransactions(
  accountNames: Record<string, string>,
  categoryNames: Record<string, string>,
  accountCurrencies: Record<string, string>,
): PendingTransactionsState {
  const queueVersion = useSyncStore((state) => state.queueVersion);
  const isOnline = useSyncStore((state) => state.online);
  const [state, setState] = useState<PendingTransactionsState>(EMPTY);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const records = await getPendingTransactionRecords();
        if (cancelled) {
          return;
        }
        const pendingIds = new Set(records.map((record) => record.entityId));
        const items =
          records.length > 0
            ? await pendingRecordsToItems(
                accountNames,
                categoryNames,
                accountCurrencies,
              )
            : [];
        if (!cancelled) {
          setState({ items, pendingIds });
        }
      } catch {
        if (!cancelled) {
          setState(EMPTY);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // Lookups are memoized upstream; re-read the queue when they change.
  }, [queueVersion, isOnline, accountNames, categoryNames, accountCurrencies]);

  return state;
}

"use client";

import { useEffect, useState } from "react";

import {
  getPendingTransactionRecords,
  pendingRecordsToItems,
} from "@/lib/offline/sync-client";
import type { TransactionItem } from "@/types/dashboard";
import { useSyncStore } from "@/stores/sync.store";

interface PendingTransactionsState {
  items: TransactionItem[];
  pendingIds: ReadonlySet<string>;
}

const EMPTY: PendingTransactionsState = { items: [], pendingIds: new Set() };

export function usePendingTransactions(
  categoryNames: Record<string, string>,
): PendingTransactionsState {
  const queueVersion = useSyncStore((state) => state.queueVersion);
  const isOnline = useSyncStore((state) => state.online);
  const [state, setState] = useState<PendingTransactionsState>(EMPTY);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const records = await getPendingTransactionRecords();
        if (cancelled) return;
        const pendingIds = new Set(records.map((record) => record.entityId));
        const items =
          records.length > 0
            ? await pendingRecordsToItems(categoryNames)
            : [];
        if (!cancelled) setState({ items, pendingIds });
      } catch {
        if (!cancelled) setState(EMPTY);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [queueVersion, isOnline, categoryNames]);

  return state;
}

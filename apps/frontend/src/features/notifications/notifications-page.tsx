"use client";

import { useEffect, useState } from "react";
import { BellRing, CheckCheck, Trash2 } from "lucide-react";
import { NotificationListItem } from "@/components/notifications/notification-list-item";
import { NotificationListSkeleton } from "@/components/notifications/notification-list-skeleton";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { TransactionPagination } from "@/components/transactions/TransactionPagination";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { uiText } from "@/locales";
import { notificationService } from "@/services/notification.service";
import { useNotificationStore } from "@/stores/notification.store";
import { useDataRefreshStore } from "@/stores/refresh.store";
import { useDashboardCurrencyStore } from "@/stores/dashboardCurrency.store";
import type { NotificationItem } from "@/types/notification";

const DEFAULT_PAGE_SIZE = 20;

type NotificationFilter = "all" | "unread";

export function NotificationsPage() {
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const dataVersion = useDataRefreshStore((state) => state.version);
  const activeCurrency = useDashboardCurrencyStore((state) => state.currency);

  const markReadInStore = useNotificationStore((state) => state.markRead);
  const markAllReadInStore = useNotificationStore((state) => state.markAllRead);
  const removeInStore = useNotificationStore((state) => state.remove);
  const removeAllInStore = useNotificationStore((state) => state.removeAll);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      setError(false);

      try {
        const result = await notificationService.list({
          page,
          limit: pageSize,
          unread: filter === "unread" ? true : undefined,
          currency: activeCurrency,
        });
        if (cancelled) return;
        setItems(result.items);
        setTotalItems(result.pagination.totalItems);
        if (page > result.pagination.totalPages) {
          setPage(result.pagination.totalPages);
        }
      } catch {
        if (!cancelled) {
          // On error, ensure UI does not remain in a stale loading state and
          // that the item list is cleared to avoid displaying outdated data.
          setItems([]);
          setTotalItems(0);
          setError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, dataVersion, page, pageSize, filter, activeCurrency]);

  const refresh = () => setRefreshKey((key) => key + 1);

  const handleFilterChange = (value: string) => {
    setFilter(value as NotificationFilter);
    setPage(1);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const handleMarkRead = async (id: string) => {
    try {
      await notificationService.markRead(id);
    } catch {
      return;
    }
    setItems((current) =>
      current.map((item) =>
        item.id === id && !item.isRead
          ? { ...item, isRead: true, readAt: new Date().toISOString() }
          : item
      )
    );
    await markReadInStore(id);
    if (filter === "unread") {
      setTotalItems((total) => Math.max(0, total - 1));
      if (items.length === 1 && page > 1) setPage((value) => value - 1);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
    } catch {
      return;
    }
    setItems((current) =>
      current.map((item) =>
        item.isRead ? item : { ...item, isRead: true, readAt: new Date().toISOString() }
      )
    );
    setTotalItems(0);
    await markAllReadInStore();
  };

  const handleDelete = async (id: string) => {
    try {
      await notificationService.remove(id);
    } catch {
      return;
    }
    setItems((current) => current.filter((item) => item.id !== id));
    setTotalItems((total) => Math.max(0, total - 1));
    removeInStore(id);
    if (items.length === 1 && page > 1) setPage((value) => value - 1);
    else refresh();
  };

  const handleClearAll = async () => {
    try {
      await notificationService.removeAll();
    } catch {
      return;
    }
    setItems([]);
    setTotalItems(0);
    await removeAllInStore();
  };

  const isEmpty = !loading && !error && totalItems === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {uiText.notificationsPage.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {uiText.notificationsPage.subtitle}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filter} onValueChange={handleFilterChange}>
            <SelectTrigger
              className="w-full sm:w-44"
              aria-label={uiText.notificationsPage.filterAriaLabel}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{uiText.notificationsPage.all}</SelectItem>
              <SelectItem value="unread">{uiText.notificationsPage.unreadOnly}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="secondary"
            className="rounded-xl"
            onClick={() => void handleMarkAllRead()}
            disabled={loading || totalItems === 0}
          >
            <CheckCheck />
            {uiText.notificationsPage.markAllRead}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl text-destructive hover:text-destructive"
            onClick={() => void handleClearAll()}
            disabled={loading || totalItems === 0}
          >
            <Trash2 />
            {uiText.notificationsPage.clearAll}
          </Button>
        </div>
      </div>

      {error ? (
        <ErrorState
          title={uiText.states.errorTitle}
          description={uiText.states.errorDescription}
          onRetry={refresh}
        />
      ) : isEmpty ? (
        <EmptyState
          title={uiText.notificationsPage.empty}
          icon={<BellRing className="size-8 text-muted-foreground" aria-hidden="true" />}
        />
      ) : loading ? (
        <NotificationListSkeleton rows={Math.min(pageSize, 6)} />
      ) : (
        <>
          <ul className="space-y-3">
            {items.map((item) => (
              <NotificationListItem
                key={item.id}
                item={item}
                onMarkRead={item.isRead ? undefined : () => void handleMarkRead(item.id)}
                onDelete={() => void handleDelete(item.id)}
              />
            ))}
          </ul>

          <TransactionPagination
            page={page}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
          />
        </>
      )}
    </div>
  );
}
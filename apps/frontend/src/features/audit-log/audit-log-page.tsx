"use client";

import { useEffect, useState } from "react";
import { History, RotateCcw, ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { TransactionPagination } from "@/components/transactions/TransactionPagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTransactionDate } from "@/lib/format";
import { uiText } from "@/locales";
import { auditLogService } from "@/services/audit-log.service";
import type { AuditLogItem } from "@/types/audit-log";
import { cn } from "@/lib/utils";

const MODULE_OPTIONS = [
  "auth",
  "user",
  "role",
  "permission",
  "account",
  "category",
  "transaction",
  "budget",
  "saving_goal",
  "investment",
];

const ACTION_OPTIONS = [
  "AUTH_LOGIN",
  "AUTH_LOGOUT",
  "AUTH_REFRESH_TOKEN",
  "AUTH_PASSWORD_CHANGED",
  "USER_CREATED",
  "USER_UPDATED",
  "USER_DELETED",
  "ROLE_CHANGED",
  "PERMISSION_CHANGED",
  "ACCOUNT_CREATED",
  "ACCOUNT_UPDATED",
  "ACCOUNT_DELETED",
  "DEFAULT_ACCOUNT_CHANGED",
  "CATEGORY_CREATED",
  "CATEGORY_UPDATED",
  "CATEGORY_DELETED",
  "TRANSACTION_CREATED",
  "TRANSACTION_UPDATED",
  "TRANSACTION_DELETED",
  "TRANSFER_CREATED",
  "TRANSFER_FAILED",
  "BUDGET_CREATED",
  "BUDGET_UPDATED",
  "BUDGET_DELETED",
  "SAVING_GOAL_CREATED",
  "SAVING_GOAL_UPDATED",
  "SAVING_GOAL_DELETED",
  "INVESTMENT_CREATED",
  "INVESTMENT_UPDATED",
  "INVESTMENT_DELETED",
];

const DEFAULT_PAGE_SIZE = 10;

export function AuditLogPage() {
  const [module, setModule] = useState("all");
  const [action, setAction] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      setError(false);

      const from = fromDate ? `${fromDate}T00:00:00.000Z` : undefined;
      const to = toDate ? `${toDate}T23:59:59.999Z` : undefined;

      try {
        const result = await auditLogService.listOwn({
          page,
          limit: pageSize,
          module: module === "all" ? undefined : module,
          action: action === "all" ? undefined : action,
          fromDate: from,
          toDate: to,
        });
        if (cancelled) return;
        setItems(result.items);
        setTotalItems(result.pagination.total);
        if (page > Math.max(1, result.pagination.totalPages)) {
          setPage(1);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, page, pageSize, module, action, fromDate, toDate]);

  const refresh = () => setRefreshKey((key) => key + 1);

  const handleReset = () => {
    setModule("all");
    setAction("all");
    setFromDate("");
    setToDate("");
    setPage(1);
    refresh();
  };

  const isEmpty = !loading && !error && totalItems === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {uiText.auditLogPage.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {uiText.auditLogPage.subtitle}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Select
          value={module}
          onValueChange={(value) => {
            setModule(value);
            setPage(1);
          }}
        >
          <SelectTrigger
            className="w-full sm:w-44"
            aria-label={uiText.auditLogPage.module}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {uiText.auditLogPage.allModules}
            </SelectItem>
            {MODULE_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={action}
          onValueChange={(value) => {
            setAction(value);
            setPage(1);
          }}
        >
          <SelectTrigger
            className="w-full sm:w-56"
            aria-label={uiText.auditLogPage.action}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {uiText.auditLogPage.allActions}
            </SelectItem>
            {ACTION_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="space-y-1">
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
            aria-label={uiText.auditLogPage.startDate}
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Input
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(1);
            }}
            aria-label={uiText.auditLogPage.endDate}
            className="h-9"
          />
        </div>

        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          onClick={handleReset}
        >
          <RotateCcw />
          {uiText.auditLogPage.resetFilters}
        </Button>
      </div>

      {error ? (
        <ErrorState
          title={uiText.states.errorTitle}
          description={uiText.auditLogPage.loadError}
          onRetry={refresh}
        />
      ) : isEmpty ? (
        <EmptyState
          title={uiText.auditLogPage.empty}
          icon={
            <History
              className="size-8 text-muted-foreground"
              aria-hidden="true"
            />
          }
        />
      ) : loading ? (
        <ul className="space-y-3" aria-hidden="true">
          {Array.from({ length: Math.min(pageSize, 5) }).map((_, index) => (
            <li key={index} className="rounded-xl border border-border p-4">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="mt-2 h-3 w-2/3" />
              <Skeleton className="mt-2 h-3 w-24" />
            </li>
          ))}
        </ul>
      ) : (
        <>
          <ul className="space-y-3">
            {items.map((item) => (
              <AuditLogRow key={item.id} item={item} />
            ))}
          </ul>

          <TransactionPagination
            page={page}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </>
      )}
    </div>
  );
}

function AuditLogRow({ item }: { item: AuditLogItem }) {
  const hasDetail =
    item.metadata !== null ||
    item.requestPath !== null ||
    item.ipAddress !== null ||
    item.userAgent !== null;

  const status = item.responseStatus ?? 200;
  const statusOk = status >= 200 && status < 300;

  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="shrink-0">
              {item.module}
            </Badge>
            <Badge variant="secondary" className="shrink-0">
              {item.action}
            </Badge>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                statusOk
                  ? "bg-success/10 text-success"
                  : "bg-danger/10 text-danger",
              )}
            >
              {item.responseStatus === null
                ? uiText.auditLogPage.status
                : `HTTP ${item.responseStatus}`}
            </span>
          </div>
          <p className="mt-2 text-sm font-medium text-foreground">
            {item.description ?? item.action}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <ShieldCheck className="size-3" aria-hidden="true" />
            {formatTransactionDate(item.createdAt)}
          </p>
        </div>
      </div>

      {hasDetail && (
        <details className="mt-3 group">
          <summary className="cursor-pointer text-xs font-medium text-primary hover:underline">
            {uiText.auditLogPage.detail}
          </summary>
          <div className="mt-2 space-y-2 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
            {item.requestPath && (
              <p>
                <span className="font-medium text-foreground">
                  {uiText.auditLogPage.requestInfo}:
                </span>{" "}
                {item.requestMethod ?? ""} {item.requestPath}
              </p>
            )}
            {item.ipAddress && <p>IP: {item.ipAddress}</p>}
            {item.userAgent && <p className="truncate">UA: {item.userAgent}</p>}
            {item.metadata !== null && (
              <div>
                <p className="font-medium text-foreground">
                  {uiText.auditLogPage.metadata}:
                </p>
                <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-background p-2 text-[11px]">
                  {JSON.stringify(item.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </details>
      )}
    </li>
  );
}

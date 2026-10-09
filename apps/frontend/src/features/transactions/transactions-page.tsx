"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { ReceiptText } from "lucide-react";
import { TransactionFilters } from "@/components/transactions/TransactionFilters";
import type { TransactionFormMode } from "@/components/transactions/TransactionForm";
import { LoadOnOpen } from "@/components/common/load-on-open";
import { TransactionPagination } from "@/components/transactions/TransactionPagination";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { TransactionToolbar } from "@/components/transactions/TransactionToolbar";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import {
  createDefaultTransactionFilters,
  DEFAULT_PAGE_SIZE,
} from "@/features/transactions/constants";
import type { TransactionFiltersState } from "@/features/transactions/types";
import type { TransactionFormValues } from "@/features/transactions/schema";
import { uiText } from "@/locales";
import { ApiError } from "@/lib/axios";
import { isoToLocalTime } from "@/lib/date";
import type { CategoryGroup } from "@/lib/categories";
import { useDataRefreshStore } from "@/stores/refresh.store";
import { syncCreateTransaction, syncDeleteTransaction, syncUpdateTransaction } from "@/lib/offline/sync-client";
import { usePendingTransactions } from "@/hooks/use-pending-transactions";
import { useTimezoneStore } from "@/stores/timezone.store";
import { categoryService } from "@/services/category.service";
import { findIdByName, toCreateTransactionPayload, toTransactionItem, toUpdateTransactionPayload, transactionService, type TransactionListParams } from "@/services/transaction.service";
import type { CategoryResponse } from "@/types/backend";
import type { TransactionItem, TransactionType } from "@/types/dashboard";

const LazyTransactionForm = dynamic(() => import("@/components/transactions/TransactionForm").then((m) => m.TransactionForm), { ssr: false });
const LazyDeleteTransactionDialog = dynamic(() => import("@/components/transactions/DeleteTransactionDialog").then((m) => m.DeleteTransactionDialog), { ssr: false });
const SEARCH_DEBOUNCE_MS = 300;
type SortKey = NonNullable<TransactionListParams["sortBy"]>;
type SortOrder = NonNullable<TransactionListParams["sortOrder"]>;
type CategoryTypeLookup = Record<string, ("INCOME" | "EXPENSE")[]>;

interface FormState { open: boolean; mode: TransactionFormMode; transaction: TransactionItem | null; session: number; }

export function getSafeReturnPath(returnTo: string | null, origin: string): string {
  if (!returnTo?.startsWith("/") || returnTo.startsWith("//")) return "/dashboard";

  try {
    const destination = new URL(returnTo, origin);
    if (destination.origin !== origin) return "/dashboard";
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/dashboard";
  }
}

function buildCategoryTypes(categories: CategoryResponse[]): CategoryTypeLookup {
  const lookup: CategoryTypeLookup = {};
  for (const category of categories) (lookup[category.name] ??= []).push(category.type);
  return lookup;
}

export function TransactionsPage({ transactionType }: { transactionType?: TransactionType } = {}) {
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const dataVersion = useDataRefreshStore((state) => state.version);
  const bumpRefresh = useDataRefreshStore((state) => state.bump);
  const timeZone = useTimezoneStore((state) => state.timezone);
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlQuery = searchParams.get("q") ?? "";
  const addQuery = searchParams.get("add");
  const returnTo = searchParams.get("returnTo");
  const [filters, setFilters] = useState<TransactionFiltersState>(() =>
    createDefaultTransactionFilters(transactionType ?? "all", timeZone),
  );
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sort, setSort] = useState<{ key: SortKey; order: SortOrder }>({ key: "date", order: "desc" });
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [categoryTypes, setCategoryTypes] = useState<CategoryTypeLookup>({});
  const [lookupsReady, setLookupsReady] = useState(false);
  const [formState, setFormState] = useState<FormState>({ open: addQuery === "1", mode: "create", transaction: null, session: 0 });
  const [deleting, setDeleting] = useState<TransactionItem | null>(null);
  const [deleteFeedback, setDeleteFeedback] = useState<{ kind: "pending" | "error"; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void categoryService.list().catch(() => [] as CategoryResponse[]).then((categories) => {
      if (cancelled) return;
      setCategoryNames(Object.fromEntries(categories.map((category) => [category.id, category.name])));
      setCategoryTypes(buildCategoryTypes(categories));
      setLookupsReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { setFilters((current) => ({ ...current, search: urlQuery, type: transactionType ?? "all" })); setPage(1); }, [urlQuery, transactionType]);
  useEffect(() => { const id = setTimeout(() => setSearch(filters.search.trim()), SEARCH_DEBOUNCE_MS); return () => clearTimeout(id); }, [filters.search]);
  const queryConfig = useMemo(() => ({
    categoryId: filters.category === "all" ? undefined : findIdByName(categoryNames, filters.category),
    type: transactionType === "income" ? "INCOME" as const : transactionType === "expense" ? "EXPENSE" as const : filters.type === "income" ? "INCOME" as const : filters.type === "expense" ? "EXPENSE" as const : undefined,
    fromDate: filters.startDate || undefined,
    toDate: filters.endDate || undefined,
  }), [filters, categoryNames, transactionType]);

  useEffect(() => {
    if (!lookupsReady) return;
    let cancelled = false;
    setLoading(true); setError(false);
    const params: TransactionListParams = { page, limit: pageSize, sortBy: sort.key, sortOrder: sort.order, ...queryConfig };
    if (search) params.q = search;
    void transactionService.list(params).then((result) => {
      if (cancelled) return;
      setTransactions(result.data.map((dto) => toTransactionItem(dto, categoryNames, timeZone)));
      setTotalItems(result.pagination.totalItems);
      setHasLoadedOnce(true);
    }).catch(() => { if (!cancelled) setError(true); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [lookupsReady, refreshKey, dataVersion, page, pageSize, sort, search, queryConfig, categoryNames, timeZone]);

  const categoryGroups = useMemo<CategoryGroup[]>(() => {
    const types = transactionType === "income"
      ? ["INCOME"]
      : transactionType === "expense"
        ? ["EXPENSE"]
        : filters.type === "income"
          ? ["INCOME"]
          : filters.type === "expense"
            ? ["EXPENSE"]
            : ["INCOME", "EXPENSE"];
    return types.map((type) => ({ label: type === "INCOME" ? uiText.transactions.typeIncome : uiText.transactions.typeExpense, items: Object.entries(categoryTypes).filter(([, categoryTypes]) => categoryTypes.includes(type as "INCOME" | "EXPENSE")).map(([name]) => name).sort() })).filter((group) => group.items.length);
  }, [categoryTypes, filters.type, transactionType]);
  const refresh = () => setRefreshKey((value) => value + 1);
  const openForm = (mode: TransactionFormMode, transaction: TransactionItem | null) => setFormState((state) => ({ open: true, mode, transaction, session: state.session + 1 }));
  const getReturnPath = () =>
    getSafeReturnPath(returnTo, window.location.origin);
  const closeCreateForm = (open: boolean) => {
    if (open || addQuery !== "1") {
      setFormState((state) => ({ ...state, open }));
      return;
    }
    router.replace(getReturnPath());
  };
  const handleSubmit = async (values: TransactionFormValues) => {
    if (formState.mode === "edit" && formState.transaction) {
      const payload = toUpdateTransactionPayload(values, categoryNames, timeZone);
      if (!payload) throw new Error("Invalid category");
      await syncUpdateTransaction(formState.transaction.id, payload);
    } else {
      const payload = toCreateTransactionPayload(values, categoryNames, transactionType, timeZone);
      if (!payload) throw new Error("Invalid category");
      await syncCreateTransaction(payload);
    }
    setPage(1); refresh(); bumpRefresh();
    if (addQuery === "1") router.replace(getReturnPath());
  };
  const handleDuplicate = async (transaction: TransactionItem) => {
    const payload = toCreateTransactionPayload({ date: transaction.date, time: transaction.dateTime ? isoToLocalTime(transaction.dateTime, timeZone) : "", type: transaction.type, category: transaction.category, amount: transaction.amount, description: transaction.description, notes: "" }, categoryNames, transactionType, timeZone);
    if (!payload) return;
    await syncCreateTransaction(payload); setPage(1); refresh(); bumpRefresh();
  };
  const { items: pendingItems, pendingIds } = usePendingTransactions(categoryNames, timeZone);
  const visibleTransactions = useMemo(() => [...pendingItems.filter((item) => !transactionType || item.type === transactionType), ...transactions.map((item) => pendingIds.has(item.id) ? { ...item, pendingSync: true } : item)], [pendingItems, pendingIds, transactions, transactionType]);
  const title = transactionType === "income" ? uiText.navigation.income : transactionType === "expense" ? uiText.navigation.expense : uiText.transactions.title;
  const subtitle = transactionType === "income" ? uiText.transactions.incomeSubtitle : transactionType === "expense" ? uiText.transactions.expenseSubtitle : uiText.transactions.subtitle;

  const showAddButton = transactionType !== undefined;
  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteFeedback(null);
    try {
      const result = await syncDeleteTransaction(deleting.id);
      if (result.queued) {
        setDeleteFeedback({ kind: "pending", message: uiText.transactions.deletePendingSync });
      }
    } catch (deleteError) {
      console.error("Failed to delete transaction from the server.", deleteError);
      const status = deleteError instanceof ApiError
        ? ` (HTTP ${deleteError.status})`
        : "";
      setDeleteFeedback({
        kind: "error",
        message: `${uiText.transactions.deleteFailed}${status}`,
      });
    } finally {
      setDeleting(null);
      refresh();
      bumpRefresh();
    }
  };

  return <div className="space-y-6"><div className="min-h-[72px]"><h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1><p className="mt-1 text-sm text-muted-foreground">{subtitle}</p></div>{deleteFeedback && <div role={deleteFeedback.kind === "error" ? "alert" : "status"} aria-live="polite" className={deleteFeedback.kind === "error" ? "rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive" : "rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground"}>{deleteFeedback.message}</div>}<TransactionToolbar count={totalItems} loading={loading && !hasLoadedOnce} onAdd={() => openForm("create", null)} showAdd={showAddButton} showCount={showAddButton} /><TransactionFilters filters={filters} categoryGroups={categoryGroups} onChange={(next) => { setFilters(next); setPage(1); }} onReset={() => { setFilters(createDefaultTransactionFilters(transactionType ?? "all", timeZone)); setPage(1); }} showTypeFilter={!transactionType} />{error ? <ErrorState title={uiText.states.errorTitle} description={uiText.states.errorDescription} onRetry={refresh} /> : !loading && hasLoadedOnce && !visibleTransactions.length ? <EmptyState title={uiText.transactions.emptyTitle} description={uiText.transactions.emptySubtitle} icon={<ReceiptText className="size-8 text-muted-foreground" aria-hidden="true" />} /> : <><TransactionTable transactions={visibleTransactions} loading={loading && !hasLoadedOnce} timeZone={timeZone} sortBy={sort.key} sortOrder={sort.order} onSortChange={(key) => { setSort((current) => current.key === key ? { key, order: current.order === "asc" ? "desc" : "asc" } : { key, order: "desc" }); setPage(1); }} onView={(transaction) => openForm("view", transaction)} onEdit={(transaction) => openForm("edit", transaction)} onDuplicate={(transaction) => void handleDuplicate(transaction)} onDelete={(transaction) => { setDeleteFeedback(null); setDeleting(transaction); }} hideTypeColumn={!!transactionType} />{!loading && <TransactionPagination page={page} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1); }} />}</>}<LoadOnOpen active={formState.open || deleting !== null}><LazyTransactionForm key={formState.session} open={formState.open} onOpenChange={closeCreateForm} mode={formState.mode} transaction={formState.transaction} categories={Object.values(categoryNames).sort()} categoryTypes={categoryTypes} transactionType={transactionType} timeZone={timeZone} onSubmit={handleSubmit} /><LazyDeleteTransactionDialog open={deleting !== null} onOpenChange={(open) => { if (!open) setDeleting(null); }} onConfirm={() => { void confirmDelete(); }} /></LoadOnOpen></div>;
}

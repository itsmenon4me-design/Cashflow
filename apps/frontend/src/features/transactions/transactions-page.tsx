"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, ReceiptText } from "lucide-react";
import { DeleteTransactionDialog } from "@/components/transactions/DeleteTransactionDialog";
import { TransactionFilters } from "@/components/transactions/TransactionFilters";
import {
  TransactionForm,
  type TransactionFormMode,
} from "@/components/transactions/TransactionForm";
import { TransactionPagination } from "@/components/transactions/TransactionPagination";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { TransactionToolbar } from "@/components/transactions/TransactionToolbar";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_FILTERS,
} from "@/features/transactions/constants";
import type { TransactionFiltersState } from "@/features/transactions/types";
import type { TransactionFormValues } from "@/features/transactions/schema";
import { uiText } from "@/locales";
import { isoToLocalTime } from "@/lib/date";
import type { CategoryGroup } from "@/lib/categories";
import { useDashboardCurrencyStore } from "@/stores/dashboardCurrency.store";
import { useDataRefreshStore } from "@/stores/refresh.store";
import {
  syncCreateTransaction,
  syncDeleteTransaction,
  syncUpdateTransaction,
} from "@/lib/offline/sync-client";
import { accountService } from "@/services/account.service";
import { categoryService } from "@/services/category.service";
import {
  findIdByName,
  toCreateTransactionPayload,
  toTransactionItem,
  toUpdateTransactionPayload,
  transactionService,
  type TransactionListParams,
} from "@/services/transaction.service";
import type { AccountResponse, CategoryResponse } from "@/types/backend";
import type { TransactionItem } from "@/types/dashboard";

const SEARCH_DEBOUNCE_MS = 300;

type SortKey = NonNullable<TransactionListParams["sortBy"]>;
type SortOrder = NonNullable<TransactionListParams["sortOrder"]>;

interface FormState {
  open: boolean;
  mode: TransactionFormMode;
  transaction: TransactionItem | null;
  session: number;
}

type NameLookup = Record<string, string>;
type CategoryTypeLookup = Record<string, ("INCOME" | "EXPENSE")[]>;

function buildCategoryTypes(categories: CategoryResponse[]): CategoryTypeLookup {
  const lookup: CategoryTypeLookup = {};
  for (const category of categories) {
    (lookup[category.name] ??= []).push(category.type);
  }
  return lookup;
}

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  // Set after the first successful fetch: once we know the current result is
  // empty, keep the empty state on screen during in-flight searches instead of
  // flashing the full-height table skeleton (container must not move).
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const dataVersion = useDataRefreshStore((state) => state.version);
  const bumpRefresh = useDataRefreshStore((state) => state.bump);
  const activeCurrency = useDashboardCurrencyStore((s) => s.currency);

  const defaultFilters = (() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const toInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { ...EMPTY_FILTERS, startDate: toInput(start), endDate: toInput(end) } as TransactionFiltersState;
  })();

  const [filters, setFilters] = useState<TransactionFiltersState>(defaultFilters);

  const urlQuery = useSearchParams().get("q") ?? "";

  // Ensure defaultFilters are applied after mount to avoid hydration/initialization timing issues;
  // a ?q= from the header search pre-fills the search box (header → /transactions?q=...)
  // and clears the default month range so results from any month stay visible.
  useEffect(() => {
    if (urlQuery) {
      setFilters({ ...EMPTY_FILTERS, search: urlQuery });
    } else {
      setFilters((prev) => ({ ...defaultFilters, search: prev.search }));
    }
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQuery]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sort, setSort] = useState<{ key: SortKey; order: SortOrder }>({
    key: "date",
    order: "desc",
  });

  const [lookupsReady, setLookupsReady] = useState(false);
  const [accountNames, setAccountNames] = useState<NameLookup>({});
  const [accountCurrencies, setAccountCurrencies] = useState<Record<string, string>>({});
  const [categoryNames, setCategoryNames] = useState<NameLookup>({});
  const [categoryTypes, setCategoryTypes] = useState<CategoryTypeLookup>({});

  const [formState, setFormState] = useState<FormState>({
    open: false,
    mode: "create",
    transaction: null,
    session: 0,
  });
  const [deleting, setDeleting] = useState<TransactionItem | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Mark lookups as not ready while reloading for the new currency
    setLookupsReady(false);

    void (async () => {
      const [accounts, categories] = await Promise.all([
          accountService.list(activeCurrency).catch(() => [] as AccountResponse[]),
          categoryService.list().catch(() => [] as CategoryResponse[]),
        ]);

      if (cancelled) {
        return;
      }

      setAccountNames(Object.fromEntries(accounts.map((a) => [a.id, a.name])));
      setAccountCurrencies(Object.fromEntries(accounts.map((a) => [a.id, a.currency])));
      setCategoryNames(
        Object.fromEntries(categories.map((c) => [c.id, c.name])),
      );
      setCategoryTypes(buildCategoryTypes(categories));
      setLookupsReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeCurrency]);

  // Reset pagination and trigger a refresh when dashboard currency changes to avoid stale/cross-currency data
  useEffect(() => {
    setPage(1);
    setRefreshKey((k) => k + 1);
  }, [activeCurrency]);

  useEffect(() => {
    const id = setTimeout(() => setSearch(filters.search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [filters.search]);

  const queryConfig = useMemo(() => {
    return {
      categoryId:
        filters.category === "all"
          ? undefined
          : findIdByName(categoryNames, filters.category),
      accountId:
        filters.account === "all"
          ? undefined
          : findIdByName(accountNames, filters.account),
      type:
        filters.type === "all"
          ? undefined
          : filters.type === "income"
            ? ("INCOME" as const)
            : ("EXPENSE" as const),
      fromDate: filters.startDate || undefined,
      toDate: filters.endDate || undefined,
    };
  }, [filters, accountNames, categoryNames]);

  useEffect(() => {
    if (!lookupsReady) {
      return;
    }

    let cancelled = false;

    // Stale-while-revalidate (A3/A2): only show the table skeleton on the very
    // first load of an empty list. On background refetches (search typing,
    // filter changes, global refresh bump) keep previously loaded rows visible
    // so nothing blinks while new data is in flight.
    if (transactions.length > 0 || totalItems > 0) {
      setError(false);
    } else {
      setLoading(true);
      setError(false);
    }

    const run = async () => {
      const params: TransactionListParams = {
        page,
        limit: pageSize,
        sortBy: sort.key,
        sortOrder: sort.order,
        currency: activeCurrency,
      };
      if (search) params.q = search;
      if (queryConfig.type) params.type = queryConfig.type;
      if (queryConfig.categoryId) params.categoryId = queryConfig.categoryId;
      if (queryConfig.accountId) params.accountId = queryConfig.accountId;
      if (queryConfig.fromDate) params.fromDate = queryConfig.fromDate;
      if (queryConfig.toDate) params.toDate = queryConfig.toDate;

      try {
        const result = await transactionService.list(params);
        if (cancelled) {
          return;
        }
        setTransactions(
          result.data.map((dto) =>
            toTransactionItem(dto, accountNames, categoryNames, accountCurrencies),
          ),
        );
        setTotalItems(result.pagination.totalItems);
        setHasLoadedOnce(true);
        // Ensure we never set page to less than 1 — backend validates page >= 1.
        const totalPages = result.pagination.totalPages ?? 1;
        if (page > totalPages) {
          setPage(Math.max(1, totalPages));
        }
      } catch {
        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    lookupsReady,
    refreshKey,
    dataVersion,
    page,
    pageSize,
    sort.key,
    sort.order,
    search,
    queryConfig,
    accountNames,
    categoryNames,
    activeCurrency,
  ]);

  const refresh = () => setRefreshKey((key) => key + 1);

  const categoryOptions = useMemo(
    () => [...new Set(Object.values(categoryNames))].sort(),
    [categoryNames],
  );
  const categoryGroups = useMemo<CategoryGroup[]>(() => {
    const income: string[] = [];
    const expense: string[] = [];
    for (const [name, types] of Object.entries(categoryTypes)) {
      const bucket = types.includes("INCOME") ? income : expense;
      if (!bucket.includes(name)) {
        bucket.push(name);
      }
    }
    income.sort();
    expense.sort();
    return [
      ...(income.length ? [{ label: uiText.transactions.typeIncome, items: income }] : []),
      ...(expense.length ? [{ label: uiText.transactions.typeExpense, items: expense }] : []),
    ];
  }, [categoryTypes]);
  const accountOptions = useMemo(
    () => [...new Set(Object.values(accountNames))].sort(),
    [accountNames],
  );
  const accountCurrencyByName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [id, currency] of Object.entries(accountCurrencies)) {
      const name = accountNames[id];
      if (name !== undefined) map[name] = currency;
    }
    return map;
  }, [accountNames, accountCurrencies]);

  const handleFiltersChange = (nextFilters: TransactionFiltersState) => {
    setFilters(nextFilters);
    setPage(1);
  };

  const handleResetFilters = () => {
    // Reset to the default initial period (current month) rather than clearing date filters.
    setFilters(defaultFilters);
    setPage(1);
  };

  const handlePageSizeChange = (nextPageSize: number) => {
    setPageSize(nextPageSize);
    setPage(1);
  };

  const handleSortChange = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, order: prev.order === "asc" ? "desc" : "asc" }
        : { key, order: "desc" },
    );
    setPage(1);
  };

  const openForm = (mode: TransactionFormMode, transaction: TransactionItem | null) => {
    setFormState((state) => ({
      open: true,
      mode,
      transaction,
      session: state.session + 1,
    }));
  };

  const handleFormSubmit = async (values: TransactionFormValues) => {
    if (formState.mode === "edit" && formState.transaction) {
      const payload = toUpdateTransactionPayload(
        values,
        accountNames,
        categoryNames,
        accountCurrencies,
      );
      if (payload) {
        try {
          await syncUpdateTransaction(formState.transaction.id, payload);
        } catch {
          // list tetap disinkronkan dengan state server
        }
        refresh();
        bumpRefresh();
      }
      return;
    }

    const payload = toCreateTransactionPayload(
      values,
      accountNames,
      categoryNames,
      accountCurrencies,
    );
    if (payload) {
      try {
        await syncCreateTransaction(payload);
      } catch {
        // list tetap disinkronkan dengan state server
      }
      setPage(1);
      refresh();
      bumpRefresh();
    }
  };

  const handleDuplicate = async (transaction: TransactionItem) => {
    const values: TransactionFormValues = {
      date: transaction.date,
      time: transaction.dateTime ? isoToLocalTime(transaction.dateTime) : "",
      type: transaction.type,
      category: transaction.category,
      account: transaction.account,
      amount: transaction.amount,
      description: transaction.description,
      notes: "",
    };

    const payload = toCreateTransactionPayload(
      values,
      accountNames,
      categoryNames,
      accountCurrencies,
    );
    if (payload) {
      try {
        await syncCreateTransaction(payload);
      } catch {
        // list tetap disinkronkan dengan state server
      }
      setPage(1);
      refresh();
      bumpRefresh();
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleting) {
      return;
    }

    const target = deleting;
    setDeleting(null);

    try {
      await syncDeleteTransaction(target.id);
    } catch {
      // list tetap disinkronkan dengan state server
    }

    if (transactions.length === 1 && page > 1) {
      setPage((value) => value - 1);
    } else {
      refresh();
    }
    bumpRefresh();
  };

  // Empty state persists through in-flight searches once the current result is
  // known-empty — the full table skeleton only shows on the initial load, so
  // the results container never jumps while typing.
  const isEmpty =
    !error && totalItems === 0 && transactions.length === 0 && hasLoadedOnce;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {uiText.transactions.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {uiText.transactions.subtitle}
        </p>
      </div>

      {/* Toolbar skeleton only on the initial load — during background
          refetches the stale count stays visible so it never flickers. */}
      <TransactionToolbar
        count={totalItems}
        loading={loading && !hasLoadedOnce}
        showAdd={false}
      />

      <TransactionFilters
        filters={filters}
        categoryGroups={categoryGroups}
        accounts={accountOptions}
        onChange={handleFiltersChange}
        onReset={handleResetFilters}
      />

      {error ? (
        <ErrorState
          title={uiText.states.errorTitle}
          description={uiText.states.errorDescription}
          onRetry={refresh}
        />
      ) : isEmpty ? (
      <EmptyState
        title={uiText.transactions.emptyTitle}
        description={uiText.transactions.emptySubtitle}
        icon={<ReceiptText className="size-8 text-muted-foreground" aria-hidden="true" />}
      />
      ) : (
        <>
          <TransactionTable
            transactions={transactions}
            loading={loading && transactions.length === 0}
            sortBy={sort.key}
            sortOrder={sort.order}
            onSortChange={handleSortChange}
            onView={(transaction) => openForm("view", transaction)}
            onEdit={(transaction) => openForm("edit", transaction)}
            onDuplicate={(transaction) => void handleDuplicate(transaction)}
            onDelete={setDeleting}
          />
          {/* Keep pagination mounted during background refetches (rows stay
              visible via stale-while-revalidate) — hiding it on every search
              made the area below the table blink. Hide only on the initial
              skeleton load. */}
          {(!loading || transactions.length > 0) && (
            <TransactionPagination
              page={page}
              pageSize={pageSize}
              totalItems={totalItems}
              onPageChange={setPage}
              onPageSizeChange={handlePageSizeChange}
            />
          )}
        </>
      )}

      <TransactionForm
        key={formState.session}
        open={formState.open}
        onOpenChange={(open) => setFormState((state) => ({ ...state, open }))}
        mode={formState.mode}
        transaction={formState.transaction}
        categories={categoryOptions}
        categoryTypes={categoryTypes}
        accounts={accountOptions}
        accountCurrencyByName={accountCurrencyByName}
        onSubmit={(values) => void handleFormSubmit(values)}
      />

      <DeleteTransactionDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
          }
        }}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}

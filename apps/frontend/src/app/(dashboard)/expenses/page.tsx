"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { uiText } from "@/locales";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { DeleteTransactionDialog } from "@/components/transactions/DeleteTransactionDialog";
import { TransactionFilters } from "@/components/transactions/TransactionFilters";
import { TransactionToolbar } from "@/components/transactions/TransactionToolbar";
import { TransactionPagination } from "@/components/transactions/TransactionPagination";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { toInputDate, isoToLocalTime } from "@/lib/date";
import { accountService } from "@/services/account.service";
import { useDashboardCurrencyStore } from "@/stores/dashboardCurrency.store";
import { categoryService } from "@/services/category.service";
import {
  findIdByName,
  toCreateTransactionPayload,
  toTransactionItem,
  toUpdateTransactionPayload,
  transactionService,
  type TransactionListParams,
} from "@/services/transaction.service";
import { syncCreateTransaction, syncUpdateTransaction, syncDeleteTransaction } from "@/lib/offline/sync-client";
import { useDataRefreshStore } from "@/stores/refresh.store";
import type { AccountResponse, CategoryResponse } from "@/types/backend";
import type { TransactionFormValues } from "@/features/transactions/schema";
import type { TransactionItem } from "@/types/dashboard";

const DEFAULT_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

export default function Page() {
  const bumpRefresh = useDataRefreshStore((s) => s.bump);

  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const dataVersion = useDataRefreshStore((state) => state.version);
  const activeCurrency = useDashboardCurrencyStore((s) => s.currency);

  const [filters, setFilters] = useState(() => ({ search: "", category: "all", account: "all", type: "expense", status: "all", startDate: "", endDate: "" } as any));
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sort, setSort] = useState<{ key: any; order: any }>({ key: "date", order: "desc" });

  const [lookupsReady, setLookupsReady] = useState(false);
  const [accountNames, setAccountNames] = useState<Record<string, string>>({});
  const [accountCurrencies, setAccountCurrencies] = useState<Record<string, string>>({});
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [categoryTypes, setCategoryTypes] = useState<Record<string, ("INCOME" | "EXPENSE")[]>>({});

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit" | "view">("create");
  const [formTransaction, setFormTransaction] = useState<TransactionItem | null>(null);
  const [formSession, setFormSession] = useState(0);
  const [deleting, setDeleting] = useState<TransactionItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
    const [accounts, categories] = await Promise.all([
        accountService.list(activeCurrency).catch(() => [] as AccountResponse[]),
        categoryService.list().catch(() => [] as CategoryResponse[]),
      ]);
      if (cancelled) return;
      setAccountNames(Object.fromEntries(accounts.map((a) => [a.id, a.name])));
      setAccountCurrencies(Object.fromEntries(accounts.map((a) => [a.id, a.currency])));
      setCategoryNames(Object.fromEntries(categories.map((c) => [c.id, c.name])));
      const typeLookup: Record<string, ("INCOME" | "EXPENSE")[]> = {};
      for (const c of categories) {
        (typeLookup[c.name] ??= []).push(c.type);
      }
      setCategoryTypes(typeLookup);
      setLookupsReady(true);
    })();
    return () => {
      cancelled = true;
    };
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
      fromDate: filters.startDate || undefined,
      toDate: filters.endDate || undefined,
    };
  }, [filters, accountNames, categoryNames]);

  useEffect(() => {
    if (!lookupsReady) return;
    let cancelled = false;
    const params: TransactionListParams = {
      page,
      limit: pageSize,
      sortBy: sort.key,
      sortOrder: sort.order,
      type: "EXPENSE",
      currency: activeCurrency,
    };
    if (search) params.q = search;
    if (queryConfig.categoryId) params.categoryId = queryConfig.categoryId;
    if (queryConfig.accountId) params.accountId = queryConfig.accountId;
    if (queryConfig.fromDate) params.fromDate = queryConfig.fromDate;
    if (queryConfig.toDate) params.toDate = queryConfig.toDate;

    const run = async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await transactionService.list(params as any);
        if (cancelled) return;
        setTransactions(res.data.map((d: any) => toTransactionItem(d, accountNames, categoryNames, accountCurrencies)));
        setTotalItems(res.pagination.totalItems);
        if (page > res.pagination.totalPages) setPage(res.pagination.totalPages);
      } catch (e) {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [lookupsReady, refreshKey, dataVersion, page, pageSize, sort.key, sort.order, search, queryConfig, accountNames, categoryNames, activeCurrency]);

  // Reset paging and refresh data when activeCurrency changes
  useEffect(() => {
    setPage(1);
    setRefreshKey((k) => k + 1);
  }, [activeCurrency]);

  const refresh = () => setRefreshKey((k) => k + 1);

  const categoryOptions = useMemo(() => [...new Set(Object.values(categoryNames))].sort(), [categoryNames]);
  const expenseCategories = useMemo(
    () =>
      Object.entries(categoryTypes)
        .filter(([, types]) => types.includes("EXPENSE"))
        .map(([name]) => name)
        .sort(),
    [categoryTypes],
  );
  const expenseCategoryGroups = useMemo(
    () => (expenseCategories.length ? [{ label: uiText.transactions.typeExpense, items: expenseCategories }] : []),
    [expenseCategories],
  );
  const accountOptions = useMemo(() => [...new Set(Object.values(accountNames))].sort(), [accountNames]);
  const accountCurrencyByName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [id, currency] of Object.entries(accountCurrencies)) {
      const name = accountNames[id];
      if (name !== undefined) map[name] = currency;
    }
    return map;
  }, [accountNames, accountCurrencies]);

  const handleFiltersChange = (next: any) => {
    setFilters(next);
    setPage(1);
  };

  const handleResetFilters = () => {
    setFilters({ search: "", category: "all", account: "all", type: "expense", status: "all", startDate: "", endDate: "" });
    setPage(1);
  };

  const handleSortChange = (key: any) => {
    setSort((prev) => (prev.key === key ? { key, order: prev.order === "asc" ? "desc" : "asc" } : { key, order: "desc" }));
    setPage(1);
  };

  const openForm = (mode: "create" | "edit" | "view", txn: TransactionItem | null) => {
    setFormMode(mode);
    setFormTransaction(txn);
    setFormSession((s) => s + 1);
    setFormOpen(true);
  };

  const handleFormSubmit = async (values: TransactionFormValues) => {
    if (formMode === "edit" && formTransaction) {
      // Edit path: build update payload and sync
      const payload = toUpdateTransactionPayload(values as any, accountNames, categoryNames, accountCurrencyByName as any);
      if (payload) {
        try {
          await syncUpdateTransaction(formTransaction.id, payload);
        } catch {
          // ignore - list tetap disinkronkan dengan state server
        }
        refresh();
        bumpRefresh();
      }
      setFormOpen(false);
      return;
    }
    // Force transaction type to expense when creating from the expenses page
    const payload = toCreateTransactionPayload(values as any, accountNames, categoryNames, accountCurrencyByName as any, 'expense');
    if (payload) {
      try {
        await syncCreateTransaction(payload);
      } catch {
        // ignore
      }
      setPage(1);
      refresh();
      bumpRefresh();
    }
    setFormOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);

    // TEMP DIAG: log delete attempt and context
    try {
      console.log('[DELETE FLOW] initiating delete for id=', target.id, 'activeCurrency=', activeCurrency);
    } catch (e) {
      // ignore logging errors
    }

    try {
      await syncDeleteTransaction(target.id);
      console.log('[DELETE FLOW] syncDeleteTransaction resolved for id=', target.id);
    } catch (err) {
      console.error('[DELETE FLOW] syncDeleteTransaction rejected for id=', target.id, 'error=', err);
      // list tetap disinkronkan dengan state server
    }

    if (transactions.length === 1 && page > 1) {
      setPage((v) => v - 1);
    } else {
      refresh();
    }
    bumpRefresh();
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
      values as any,
      accountNames,
      categoryNames,
      accountCurrencyByName as any,
      'expense',
    );
    if (payload) {
      try {
        await syncCreateTransaction(payload);
      } catch {
        // ignore
      }
      setPage(1);
      refresh();
      bumpRefresh();
    }
  };

  const isEmpty = !loading && !error && totalItems === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{uiText.navigation.expense}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{uiText.transactions.expenseSubtitle}</p>
      </div>

      <TransactionToolbar
        count={totalItems}
        loading={loading}
        onAdd={() => openForm("create", null)}
        showAdd={true}
      />

      <TransactionFilters
        filters={filters}
        categoryGroups={expenseCategoryGroups}
        accounts={accountOptions}
        onChange={handleFiltersChange}
        onReset={handleResetFilters}
      />

      {error ? (
        <ErrorState title={uiText.states.errorTitle} description={uiText.states.errorDescription} onRetry={refresh} />
      ) : isEmpty ? (
        <EmptyState
          title={uiText.transactions.emptyTitle}
          description={uiText.transactions.emptySubtitle}
          icon={<></>}
          actionButton={
            <Button type="button" className="rounded-xl" onClick={() => openForm("create", null)}>
              <Plus />
              + Tambah Pengeluaran
            </Button>
          }
        />
      ) : (
        <>
          <TransactionTable
            transactions={transactions}
            loading={loading}
            sortBy={sort.key}
            sortOrder={sort.order}
            onSortChange={handleSortChange}
            onView={(t) => openForm("view", t)}
            onEdit={(t) => openForm("edit", t)}
            onDuplicate={(t) => void handleDuplicate(t)}
            onDelete={setDeleting}
            hideTypeColumn
          />
          <TransactionPagination
            page={page}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </>
      )}

      <TransactionForm
        key={formSession}
        open={formOpen}
        onOpenChange={(open) => setFormOpen(open)}
        mode={formMode}
        transaction={formTransaction}
        categories={categoryOptions}
        categoryTypes={categoryTypes}
        accounts={accountOptions}
        accountCurrencyByName={accountCurrencyByName}
        transactionType={"expense"}
        initialValues={{ date: toInputDate(new Date()), type: "expense" }}
        onSubmit={(v) => void handleFormSubmit(v)}
      />

      <DeleteTransactionDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}

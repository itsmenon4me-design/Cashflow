"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { uiText } from "@/locales";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { TransactionFilters } from "@/components/transactions/TransactionFilters";
import { TransactionToolbar } from "@/components/transactions/TransactionToolbar";
import { TransactionPagination } from "@/components/transactions/TransactionPagination";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { Button } from "@/components/ui/button";
import { accountService } from "@/services/account.service";
import { categoryService } from "@/services/category.service";
import {
  toCreateTransactionPayload,
  toTransactionItem,
  transactionService,
  type TransactionListParams,
} from "@/services/transaction.service";
import { syncCreateTransaction } from "@/lib/offline/sync-client";
import { useDataRefreshStore } from "@/stores/refresh.store";
import type { AccountResponse, CategoryResponse } from "@/types/backend";
import type { TransactionFormValues } from "@/features/transactions/schema";
import type { TransactionItem } from "@/types/dashboard";

const DEFAULT_PAGE_SIZE = 20;

export default function Page() {
  const bumpRefresh = useDataRefreshStore((s) => s.bump);

  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const dataVersion = useDataRefreshStore((state) => state.version);

  const [filters, setFilters] = useState(() => ({ search: "", category: "all", account: "all", type: "expense", status: "all", startDate: "", endDate: "" } as any));
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sort, setSort] = useState<{ key: any; order: any }>({ key: "date", order: "desc" });

  const [lookupsReady, setLookupsReady] = useState(false);
  const [accountNames, setAccountNames] = useState<Record<string, string>>({});
  const [accountCurrencies, setAccountCurrencies] = useState<Record<string, string>>({});
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit" | "view">("create");
  const [formTransaction, setFormTransaction] = useState<TransactionItem | null>(null);
  const [formSession, setFormSession] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [accounts, categories] = await Promise.all([
        accountService.list().catch(() => [] as AccountResponse[]),
        categoryService.list().catch(() => [] as CategoryResponse[]),
      ]);
      if (cancelled) return;
      setAccountNames(Object.fromEntries(accounts.map((a) => [a.id, a.name])));
      setAccountCurrencies(Object.fromEntries(accounts.map((a) => [a.id, a.currency])));
      setCategoryNames(Object.fromEntries(categories.map((c) => [c.id, c.name])));
      setLookupsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!lookupsReady) return;
    let cancelled = false;
    const params: TransactionListParams = {
      page,
      limit: pageSize,
      sortBy: sort.key,
      sortOrder: sort.order,
      type: "EXPENSE",
    };
    if (search) params.q = search;

    const run = async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await transactionService.list(params as any);
        if (cancelled) return;
        setTransactions(res.data.map((d: any) => toTransactionItem(d, accountNames, categoryNames)));
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
  }, [lookupsReady, refreshKey, dataVersion, page, pageSize, sort.key, sort.order, search, accountNames, categoryNames]);

  const refresh = () => setRefreshKey((k) => k + 1);

  const categoryOptions = useMemo(() => [...new Set(Object.values(categoryNames))].sort(), [categoryNames]);
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
      // not implementing edit path here; reuse transactions page for full edit
      return;
    }
    const payload = toCreateTransactionPayload(values as any, accountNames, categoryNames, accountCurrencyByName as any);
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

  const isEmpty = !loading && !error && totalItems === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Pengeluaran</h1>
        <p className="mt-1 text-sm text-muted-foreground">Kelola seluruh transaksi pengeluaran Anda.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <TransactionToolbar
            count={totalItems}
            loading={loading}
            onAdd={() => openForm("create", null)}
            onExport={() => undefined}
            onImport={() => undefined}
          />
        </div>
        <div className="flex items-center md:justify-end">
          <div className="grid grid-cols-1 w-full max-w-md">
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="text-xs text-muted-foreground">Jumlah Transaksi</div>
              <div className="mt-1 text-lg font-semibold">{totalItems}</div>
            </div>
          </div>
        </div>
      </div>

      <TransactionFilters
        filters={filters}
        categories={categoryOptions}
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
            onDuplicate={(t) => void 0}
            onDelete={(t) => void 0}
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
        accounts={accountOptions}
        accountCurrencyByName={accountCurrencyByName}
        transactionType={"expense"}
        initialValues={{ date: new Date().toISOString().slice(0, 10), type: "expense" }}
        onSubmit={(v) => void handleFormSubmit(v)}
      />
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Button } from "@/components/ui/button";
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_FILTERS,
} from "@/features/transactions/constants";
import type { TransactionFiltersState } from "@/features/transactions/types";
import type { TransactionFormValues } from "@/features/transactions/schema";
import { recentTransactions } from "@/lib/mock-data";
import { uiText } from "@/locales";
import type { TransactionItem } from "@/types/dashboard";

const LOADING_DURATION_MS = 500;

interface FormState {
  open: boolean;
  mode: TransactionFormMode;
  transaction: TransactionItem | null;
}

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionItem[]>(recentTransactions);
  const [filters, setFilters] = useState<TransactionFiltersState>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [formState, setFormState] = useState<FormState>({
    open: false,
    mode: "create",
    transaction: null,
  });
  const [deleting, setDeleting] = useState<TransactionItem | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), LOADING_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(transactions.map((txn) => txn.category))).sort(),
    [transactions]
  );
  const accounts = useMemo(
    () => Array.from(new Set(transactions.map((txn) => txn.account))).sort(),
    [transactions]
  );

  const filtered = useMemo(() => {
    const keyword = filters.search.trim().toLowerCase();
    return transactions.filter((txn) => {
      const matchesKeyword =
        keyword === "" ||
        txn.description.toLowerCase().includes(keyword) ||
        txn.category.toLowerCase().includes(keyword) ||
        txn.account.toLowerCase().includes(keyword);
      const matchesCategory = filters.category === "all" || txn.category === filters.category;
      const matchesAccount = filters.account === "all" || txn.account === filters.account;
      const matchesType = filters.type === "all" || txn.type === filters.type;
      const matchesStatus = filters.status === "all" || txn.status === filters.status;
      const matchesStartDate = filters.startDate === "" || txn.date >= filters.startDate;
      const matchesEndDate = filters.endDate === "" || txn.date <= filters.endDate;
      return (
        matchesKeyword &&
        matchesCategory &&
        matchesAccount &&
        matchesType &&
        matchesStatus &&
        matchesStartDate &&
        matchesEndDate
      );
    });
  }, [transactions, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const visibleRows = filtered.slice(startIndex, startIndex + pageSize);

  const handleFiltersChange = (nextFilters: TransactionFiltersState) => {
    setFilters(nextFilters);
    setPage(1);
  };

  const handleResetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const handlePageSizeChange = (nextPageSize: number) => {
    setPageSize(nextPageSize);
    setPage(1);
  };

  const openForm = (mode: TransactionFormMode, transaction: TransactionItem | null) => {
    setFormState({ open: true, mode, transaction });
  };

  const handleFormSubmit = (values: TransactionFormValues) => {
    if (formState.mode === "edit" && formState.transaction) {
      const current = formState.transaction;
      const description = values.description?.trim() || current.description;
      setTransactions((prev) =>
        prev.map((txn) =>
          txn.id === current.id
            ? { ...txn, ...values, id: txn.id, status: txn.status, description }
            : txn
        )
      );
      return;
    }
    const nextTransaction: TransactionItem = {
      id: `txn-${Date.now()}`,
      date: values.date,
      category: values.category,
      description: values.description?.trim() || values.category,
      account: values.account,
      amount: values.amount,
      type: values.type,
      status: "completed",
    };
    setTransactions((prev) => [nextTransaction, ...prev]);
  };

  const handleDuplicate = (transaction: TransactionItem) => {
    const duplicate: TransactionItem = {
      ...transaction,
      id: `txn-${Date.now()}`,
    };
    setTransactions((prev) => [duplicate, ...prev]);
  };

  const handleConfirmDelete = () => {
    if (!deleting) {
      return;
    }
    setTransactions((prev) => prev.filter((txn) => txn.id !== deleting.id));
    setDeleting(null);
  };

  const isEmpty = !loading && filtered.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {uiText.transactions.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{uiText.transactions.subtitle}</p>
      </div>

      <TransactionToolbar
        count={filtered.length}
        loading={loading}
        onAdd={() => openForm("create", null)}
        onExport={() => undefined}
        onImport={() => undefined}
      />

      <TransactionFilters
        filters={filters}
        categories={categories}
        accounts={accounts}
        onChange={handleFiltersChange}
        onReset={handleResetFilters}
      />

      {isEmpty ? (
        <EmptyState
          title={uiText.transactions.emptyTitle}
          description={uiText.transactions.emptySubtitle}
          icon={<ReceiptText className="size-8 text-muted-foreground" aria-hidden="true" />}
          actionButton={
            <Button type="button" className="rounded-xl" onClick={() => openForm("create", null)}>
              <Plus />
              {uiText.transactions.add}
            </Button>
          }
        />
      ) : (
        <>
          <TransactionTable
            transactions={visibleRows}
            loading={loading}
            onView={(transaction) => openForm("view", transaction)}
            onEdit={(transaction) => openForm("edit", transaction)}
            onDuplicate={handleDuplicate}
            onDelete={setDeleting}
          />
          <TransactionPagination
            page={currentPage}
            pageSize={pageSize}
            totalItems={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
          />
        </>
      )}

      <TransactionForm
        open={formState.open}
        onOpenChange={(open) => setFormState((state) => ({ ...state, open }))}
        mode={formState.mode}
        transaction={formState.transaction}
        categories={categories}
        accounts={accounts}
        onSubmit={handleFormSubmit}
      />

      <DeleteTransactionDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
          }
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

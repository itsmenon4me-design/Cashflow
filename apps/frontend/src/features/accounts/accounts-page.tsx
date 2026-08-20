"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Wallet } from "lucide-react";
import { AccountFilters } from "@/components/accounts/AccountFilters";
import { AccountForm, type AccountFormMode } from "@/components/accounts/AccountForm";
import { AccountTable } from "@/components/accounts/AccountTable";
import { AccountToolbar } from "@/components/accounts/AccountToolbar";
import { DeleteAccountDialog } from "@/components/accounts/DeleteAccountDialog";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { Button } from "@/components/ui/button";
import { TransactionPagination } from "@/components/transactions/TransactionPagination";
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_FILTERS,
} from "@/features/accounts/constants";
import type { AccountFiltersState } from "@/features/accounts/types";
import {
  toCreateAccountPayload,
  toUpdateAccountPayload,
} from "@/features/accounts/schema";
import { uiText } from "@/locales";
import {
  accountService,
  toAccountItem,
  type AccountItem,
} from "@/services/account.service";
import type { AccountFormValues } from "@/features/accounts/schema";
import { useDataRefreshStore } from "@/stores/refresh.store";
import { useDashboardCurrencyStore } from "@/stores/dashboardCurrency.store";

interface FormState {
  open: boolean;
  mode: AccountFormMode;
  account: AccountItem | null;
}

export function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const activeCurrency = useDashboardCurrencyStore((s) => s.currency);
  const dataVersion = useDataRefreshStore((state) => state.version);
  const [filters, setFilters] = useState<AccountFiltersState>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [formState, setFormState] = useState<FormState>({
    open: false,
    mode: "create",
    account: null,
  });
  const [deleting, setDeleting] = useState<AccountItem | null>(null);

  const fetchAccounts = useCallback(async () => {
    const data = await accountService.list(activeCurrency);
    return data.map(toAccountItem);
  }, [activeCurrency]);

  const load = useCallback(async () => {
    try {
      setAccounts(await fetchAccounts());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [fetchAccounts]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      await Promise.resolve();
      if (cancelled) {
        return;
      }
      setLoading(true);
      setError(false);
      try {
        const items = await fetchAccounts();
        if (!cancelled) {
          setAccounts(items);
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
  }, [fetchAccounts, dataVersion]);

  const filtered = useMemo(() => {
    const keyword = filters.search.trim().toLowerCase();
    return accounts.filter((account) => {
      const matchesKeyword =
        keyword === "" ||
        account.name.toLowerCase().includes(keyword) ||
        (account.description?.toLowerCase().includes(keyword) ?? false);
      const matchesType = filters.type === "all" || account.accountType === filters.type;
      return matchesKeyword && matchesType;
    });
  }, [accounts, filters]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      switch (filters.sort) {
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "name_desc":
          return b.name.localeCompare(a.name);
        case "balance_asc":
          return a.balance - b.balance;
        case "balance_desc":
          return b.balance - a.balance;
        case "created_desc":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "created_asc":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
    });
  }, [filtered, filters.sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const visibleRows = sorted.slice(startIndex, startIndex + pageSize);

  const handleFiltersChange = (nextFilters: AccountFiltersState) => {
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

  const openForm = (mode: AccountFormMode, account: AccountItem | null) => {
    setFormState({ open: true, mode, account });
  };

  const handleFormSubmit = async (values: AccountFormValues) => {
    if (formState.mode === "edit" && formState.account) {
      // propagate errors to the caller so the form can display them
      await accountService.update(
        formState.account.id,
        toUpdateAccountPayload(values),
        activeCurrency,
      );
      void load();
      return true;
    }

    // create flow - let errors bubble to caller for UI handling
    await accountService.create(toCreateAccountPayload(values), activeCurrency);
    setPage(1);
    void load();
    return true;
  };

  const handleSetDefault = async (account: AccountItem) => {
    if (account.isDefault) {
      return;
    }
    try {
      await accountService.setDefault(account.id);
    } catch {
      // daftar tetap disinkronkan dengan state server
    }
    void load();
  };

  const handleConfirmDelete = async () => {
    if (!deleting) {
      return;
    }
    const target = deleting;
    setDeleting(null);
    try {
      await accountService.remove(target.id, activeCurrency);
    } catch {
      // daftar tetap disinkronkan dengan state server
    }
    if (sorted.length === 1 && page > 1) {
      setPage((value) => value - 1);
    } else {
      void load();
    }
  };

  const isEmpty = !loading && !error && sorted.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {uiText.accounts.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {uiText.accounts.subtitle}
        </p>
      </div>

      <AccountToolbar
        count={sorted.length}
        loading={loading}
        onAdd={() => openForm("create", null)}
      />

      <AccountFilters
        filters={filters}
        onChange={handleFiltersChange}
        onReset={handleResetFilters}
      />

      {error ? (
        <ErrorState
          title={uiText.states.errorTitle}
          description={uiText.states.errorDescription}
          onRetry={() => void load()}
        />
      ) : isEmpty ? (
        <EmptyState
          title={uiText.accounts.emptyTitle}
          description={uiText.accounts.emptySubtitle}
          icon={<Wallet className="size-8 text-muted-foreground" aria-hidden="true" />}
          actionButton={
            <Button type="button" className="rounded-xl" onClick={() => openForm("create", null)}>
              <Plus />
              {uiText.accounts.add}
            </Button>
          }
        />
      ) : (
        <>
          <AccountTable
            accounts={visibleRows}
            loading={loading}
            onView={(account) => openForm("view", account)}
            onEdit={(account) => openForm("edit", account)}
            onSetDefault={(account) => void handleSetDefault(account)}
            onDelete={setDeleting}
          />
          <TransactionPagination
            page={currentPage}
            pageSize={pageSize}
            totalItems={sorted.length}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
          />
        </>
      )}

      <AccountForm
        open={formState.open}
        onOpenChange={(open) => setFormState((state) => ({ ...state, open }))}
        mode={formState.mode}
        account={formState.account}
        onSubmit={handleFormSubmit}
      />

      <DeleteAccountDialog
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
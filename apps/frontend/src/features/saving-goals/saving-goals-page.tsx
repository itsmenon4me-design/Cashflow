"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Target } from "lucide-react";
import { DeleteSavingGoalDialog } from "@/components/saving-goals/DeleteSavingGoalDialog";
import { SavingGoalFilters } from "@/components/saving-goals/SavingGoalFilters";
import { SavingGoalForm, type SavingGoalFormMode } from "@/components/saving-goals/SavingGoalForm";
import { SavingGoalTable } from "@/components/saving-goals/SavingGoalTable";
import { SavingGoalToolbar } from "@/components/saving-goals/SavingGoalToolbar";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { Button } from "@/components/ui/button";
import { TransactionPagination } from "@/components/transactions/TransactionPagination";
import { DEFAULT_PAGE_SIZE, EMPTY_FILTERS } from "@/features/saving-goals/constants";
import type { SavingGoalFiltersState } from "@/features/saving-goals/types";
import {
  toCreateSavingGoalPayload,
  toUpdateSavingGoalPayload,
  type SavingGoalFormValues,
} from "@/features/saving-goals/schema";
import { normalizeDashboardCurrency } from "@/lib/dashboard-currency";
import { uiText } from "@/locales";
import { accountService } from "@/services/account.service";
import { useDashboardCurrencyStore } from "@/stores/dashboardCurrency.store";
import { categoryService } from "@/services/category.service";
import {
  savingGoalService,
  toSavingGoalItem,
  type SavingGoalItem,
  type SupportedEntityCurrency,
} from "@/services/saving-goal.service";
import type { AccountResponse, CategoryResponse } from "@/types/backend";

interface FormState {
  open: boolean;
  mode: SavingGoalFormMode;
  goal: SavingGoalItem | null;
  session: number;
}

type NameLookup = Record<string, string>;

export function SavingGoalsPage() {
  const [goals, setGoals] = useState<SavingGoalItem[]>([]);
  const [filters, setFilters] = useState<SavingGoalFiltersState>(EMPTY_FILTERS);
  const activeCurrency = useDashboardCurrencyStore((s) => s.currency);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [accountNames, setAccountNames] = useState<NameLookup>({});
  const [accountCurrencies, setAccountCurrencies] = useState<Record<string, string>>({});
  const [categoryNames, setCategoryNames] = useState<NameLookup>({});
  const [formState, setFormState] = useState<FormState>({
    open: false,
    mode: "create",
    goal: null,
    session: 0,
  });
  const [deleting, setDeleting] = useState<SavingGoalItem | null>(null);

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
        const [items, accounts, categories] = await Promise.all([
          savingGoalService.list(activeCurrency),
          accountService.list(activeCurrency).catch(() => [] as AccountResponse[]),
          categoryService.list().catch(() => [] as CategoryResponse[]),
        ]);
        if (cancelled) {
          return;
        }
        const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
        const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));
        setAccountNames(accountMap);
        setAccountCurrencies(
          Object.fromEntries(accounts.map((a) => [a.id, a.currency])),
        );
        setCategoryNames(categoryMap);
        setGoals(items.map((goal) => toSavingGoalItem(goal, accountMap, categoryMap)));
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
  }, [refreshKey, activeCurrency]);

  const visible = useMemo(() => {
    const keyword = filters.search.trim().toLowerCase();
    const list = goals.filter(
      (goal) =>
        (filters.status === "all" || goal.status === filters.status) &&
        (keyword === "" ||
          goal.name.toLowerCase().includes(keyword) ||
          (goal.description?.toLowerCase().includes(keyword) ?? false)),
    );
    const arr = [...list];
    switch (filters.sort) {
      case "name_asc":
        arr.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name_desc":
        arr.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "target_desc":
        arr.sort((a, b) => b.target - a.target);
        break;
      case "target_asc":
        arr.sort((a, b) => a.target - b.target);
        break;
      case "progress_desc":
        arr.sort((a, b) => b.percentage - a.percentage);
        break;
      case "target_date_asc":
        arr.sort(
          (a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime(),
        );
        break;
    }
    return arr;
  }, [goals, filters]);

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const rows = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const accountOptions = useMemo(
    () =>
      Object.entries(accountNames).map(([id, name]) => ({ id, name })),
    [accountNames],
  );
  const categoryOptions = useMemo(
    () =>
      Object.entries(categoryNames).map(([id, name]) => ({ id, name })),
    [categoryNames],
  );

  const handleFiltersChange = (nextFilters: SavingGoalFiltersState) => {
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

  const openForm = (mode: SavingGoalFormMode, goal: SavingGoalItem | null) => {
    setFormState((state) => ({ open: true, mode, goal, session: state.session + 1 }));
  };

  const goalCurrency = (
    values: SavingGoalFormValues,
  ): SupportedEntityCurrency =>
    normalizeDashboardCurrency(
      values.accountId ? accountCurrencies[values.accountId] : undefined,
    ) ?? "USD";

  const handleFormSubmit = async (values: SavingGoalFormValues) => {
    if (formState.mode === "edit" && formState.goal) {
      try {
        await savingGoalService.update(
          formState.goal.id,
          toUpdateSavingGoalPayload(values, goalCurrency(values)),
          activeCurrency,
        );
      } catch {
        // daftar tetap disinkronkan dengan state server
      }
      setRefreshKey((key) => key + 1);
      return;
    }

    try {
      await savingGoalService.create(
        toCreateSavingGoalPayload(values, goalCurrency(values)),
      );
    } catch {
      // daftar tetap disinkronkan dengan state server
    }
    setPage(1);
    setRefreshKey((key) => key + 1);
  };

  const handleConfirmDelete = async () => {
    if (!deleting) {
      return;
    }
    const target = deleting;
    setDeleting(null);
    try {
      await savingGoalService.remove(target.id, activeCurrency);
    } catch {
      // daftar tetap disinkronkan dengan state server
    }
    if (visible.length === 1 && page > 1) {
      setPage((value) => value - 1);
    } else {
      setRefreshKey((key) => key + 1);
    }
  };

  const isEmpty = !loading && !error && visible.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {uiText.savingGoals.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {uiText.savingGoals.subtitle}
        </p>
      </div>

      <SavingGoalToolbar
        count={visible.length}
        loading={loading}
        onAdd={() => openForm("create", null)}
      />

      <SavingGoalFilters
        filters={filters}
        onChange={handleFiltersChange}
        onReset={handleResetFilters}
      />

      {error ? (
        <ErrorState
          title={uiText.states.errorTitle}
          description={uiText.states.errorDescription}
          onRetry={() => setRefreshKey((key) => key + 1)}
        />
      ) : isEmpty ? (
        <EmptyState
          title={uiText.savingGoals.emptyTitle}
          description={uiText.savingGoals.emptySubtitle}
          icon={<Target className="size-8 text-muted-foreground" aria-hidden="true" />}
          actionButton={
            <Button type="button" className="rounded-xl" onClick={() => openForm("create", null)}>
              <Plus />
              {uiText.savingGoals.add}
            </Button>
          }
        />
      ) : (
        <>
          <SavingGoalTable
            goals={rows}
            loading={loading}
            onView={(goal) => openForm("view", goal)}
            onEdit={(goal) => openForm("edit", goal)}
            onDelete={setDeleting}
          />
          <TransactionPagination
            page={currentPage}
            pageSize={pageSize}
            totalItems={visible.length}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
          />
        </>
      )}

      <SavingGoalForm
        key={formState.session}
        open={formState.open}
        onOpenChange={(open) => setFormState((state) => ({ ...state, open }))}
        mode={formState.mode}
        goal={formState.goal}
        accounts={accountOptions}
        accountCurrencies={accountCurrencies}
        categories={categoryOptions}
        onSubmit={(values) => void handleFormSubmit(values)}
      />

      <DeleteSavingGoalDialog
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
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, ReceiptText } from "lucide-react";
import { BudgetFilters, type BudgetPeriod } from "@/components/budgets/BudgetFilters";
import { BudgetForm, type BudgetFormMode } from "@/components/budgets/BudgetForm";
import { BudgetProgress } from "@/components/budgets/BudgetProgress";
import { BudgetTable } from "@/components/budgets/BudgetTable";
import { BudgetToolbar } from "@/components/budgets/BudgetToolbar";
import { DeleteBudgetDialog } from "@/components/budgets/DeleteBudgetDialog";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionPagination } from "@/components/transactions/TransactionPagination";
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_FILTERS,
  getYearOptions,
} from "@/features/budgets/constants";
import type { BudgetFiltersState } from "@/features/budgets/types";
import {
  toCreateBudgetPayload,
  toUpdateBudgetPayload,
  type BudgetFormValues,
} from "@/features/budgets/schema";
import { formatCurrencyCents } from "@/lib/format";
import { categoryLabel } from "@/lib/categories";
import { uiText } from "@/locales";
import { categoryService } from "@/services/category.service";
import { useDashboardCurrencyStore } from "@/stores/dashboardCurrency.store";
import {
  budgetService,
  toBudgetItem,
  type BudgetAnalysisResponse,
  type BudgetItem,
  type BudgetResponse,
} from "@/services/budget.service";

interface FormState {
  open: boolean;
  mode: BudgetFormMode;
  budget: BudgetItem | null;
  session: number;
}

interface ExpenseOption {
  id: string;
  name: string;
}

function currentPeriod(): BudgetPeriod {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

/** Parse ?month=&year= (used by global-search landing links) into a period. */
function periodFromSearchParams(params: URLSearchParams): BudgetPeriod | null {
  const month = Number(params.get("month"));
  const year = Number(params.get("year"));
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(year) || year < 1970 || year > 2100) return null;
  return { month, year };
}

export function BudgetsPage() {
  const activeCurrency = useDashboardCurrencyStore((s) => s.currency);
  const searchParams = useSearchParams();
  const [rawBudgets, setRawBudgets] = useState<BudgetResponse[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseOption[]>([]);
  const [analysis, setAnalysis] = useState<BudgetAnalysisResponse | null>(null);
  const [filters, setFilters] = useState<BudgetFiltersState>(EMPTY_FILTERS);
  const [period, setPeriod] = useState<BudgetPeriod>(
    () => periodFromSearchParams(new URLSearchParams(searchParams.toString())) ?? currentPeriod(),
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [formState, setFormState] = useState<FormState>({
    open: false,
    mode: "create",
    budget: null,
    session: 0,
  });
  const [deleting, setDeleting] = useState<BudgetItem | null>(null);

  // Keep period in sync with ?month=&year= (e.g. landing from a global-search result).
  useEffect(() => {
    const next = periodFromSearchParams(new URLSearchParams(searchParams.toString()));
    if (next) {
      setPeriod(next);
      setPage(1);
    }
  }, [searchParams]);

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
        const [budgets, categories] = await Promise.all([
          budgetService.list(activeCurrency),
          categoryService.list(),
        ]);
        if (cancelled) {
          return;
        }
        setRawBudgets(budgets);
        setExpenseCategories(
          categories
            .filter(
              (category) =>
                category.type === "EXPENSE" && category.name !== "Transfer Out",
            )
            .map((category) => ({ id: category.id, name: category.name })),
        );
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

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      await Promise.resolve();
      if (cancelled) {
        return;
      }
      try {
        const result = await budgetService.analysis(
          period.month,
          period.year,
          activeCurrency,
        );
        if (!cancelled) {
          setAnalysis(result);
        }
      } catch {
        if (!cancelled) {
          setError(true);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [period, refreshKey, activeCurrency]);

  const budgetItems = useMemo(() => {
    const spentByCategory: Record<string, number> = {};
    for (const category of analysis?.categories ?? []) {
      spentByCategory[category.categoryId] = category.spentAmount;
    }
    return rawBudgets.map((budget) => toBudgetItem(budget, spentByCategory));
  }, [rawBudgets, analysis]);

  const visible = useMemo(() => {
    const keyword = filters.search.trim().toLowerCase();
    const list = budgetItems.filter(
      (budget) =>
        budget.month === period.month &&
        budget.year === period.year &&
        (keyword === "" ||
          budget.categoryName.toLowerCase().includes(keyword) ||
          categoryLabel(budget.categoryName).toLowerCase().includes(keyword)),
    );
    const arr = [...list];
    switch (filters.sort) {
      case "category_asc":
        arr.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
        break;
      case "category_desc":
        arr.sort((a, b) => b.categoryName.localeCompare(a.categoryName));
        break;
      case "amount_desc":
        arr.sort((a, b) => b.amount - a.amount);
        break;
      case "amount_asc":
        arr.sort((a, b) => a.amount - b.amount);
        break;
      case "spent_desc":
        arr.sort((a, b) => b.spent - a.spent);
        break;
      case "percentage_desc":
        arr.sort((a, b) => b.percentage - a.percentage);
        break;
    }
    return arr;
  }, [budgetItems, filters, period]);

  const overall = analysis?.overall ?? {
    budget: 0,
    spent: 0,
    remaining: 0,
    percentageUsed: 0,
  };

  // Convert overall cents -> major units for display using existing formatter
  const overallBudgetDisplay = formatCurrencyCents(overall.budget);
  const overallSpentDisplay = formatCurrencyCents(overall.spent);
  const overallRemainingDisplay = formatCurrencyCents(overall.remaining);

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const rows = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleFiltersChange = (nextFilters: BudgetFiltersState) => {
    setFilters(nextFilters);
    setPage(1);
  };

  const handleResetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPeriod(currentPeriod());
    setPage(1);
  };

  const handlePeriodChange = (nextPeriod: BudgetPeriod) => {
    setPeriod(nextPeriod);
    setPage(1);
  };

  const handlePageSizeChange = (nextPageSize: number) => {
    setPageSize(nextPageSize);
    setPage(1);
  };

  const openForm = (mode: BudgetFormMode, budget: BudgetItem | null) => {
    setFormState((state) => ({ open: true, mode, budget, session: state.session + 1 }));
  };

  const handleFormSubmit = async (values: BudgetFormValues) => {
    if (formState.mode === "edit" && formState.budget) {
      try {
        await budgetService.update(
          formState.budget.id,
          toUpdateBudgetPayload(values),
          activeCurrency,
        );
      } catch {
        // daftar tetap disinkronkan dengan state server
      }
      setRefreshKey((key) => key + 1);
      return;
    }

    try {
      await budgetService.create(toCreateBudgetPayload(values));
    } catch {
      // daftar tetap disinkronkan dengan state server
    }
    setPeriod({ month: values.month, year: values.year });
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
      await budgetService.remove(target.id, activeCurrency);
    } catch {
      // daftar tetap disinkronkan dengan state server
    }
    setRefreshKey((key) => key + 1);
  };

  const isEmpty = !loading && !error && visible.length === 0;
  const isSearchActive = filters.search.trim().length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {uiText.budgets.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {uiText.budgets.subtitle}
        </p>
      </div>

      <BudgetToolbar
        count={visible.length}
        loading={loading}
        onAdd={() => openForm("create", null)}
      />

      <BudgetFilters
        filters={filters}
        years={getYearOptions()}
        period={period}
        onChange={handleFiltersChange}
        onPeriodChange={handlePeriodChange}
        onReset={handleResetFilters}
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <BudgetStat
          label={uiText.budgets.totalBudget}
          value={overallBudgetDisplay}
          loading={loading}
        />
        <BudgetStat
          label={uiText.budgets.totalSpent}
          value={overallSpentDisplay}
          loading={loading}
        />
        <BudgetStat
          label={uiText.budgets.remaining}
          value={overallRemainingDisplay}
          loading={loading}
        />
        <BudgetStat
          label={uiText.budgets.usage}
          value={`${overall.percentageUsed.toFixed(0)}%`}
          loading={loading}
          progress={overall.percentageUsed}
        />
      </section>

      {error ? (
        <ErrorState
          title={uiText.states.errorTitle}
          description={uiText.states.errorDescription}
          onRetry={() => setRefreshKey((key) => key + 1)}
        />
      ) : isEmpty ? (
        <EmptyState
          title={isSearchActive ? uiText.budgets.emptySearchTitle : uiText.budgets.emptyTitle}
          description={isSearchActive ? uiText.budgets.emptySearchSubtitle : uiText.budgets.emptySubtitle}
          icon={<ReceiptText className="size-8 text-muted-foreground" aria-hidden="true" />}
          actionButton={
            !isSearchActive ? (
              <Button type="button" className="rounded-xl" onClick={() => openForm("create", null)}>
                <Plus />
                {uiText.budgets.add}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <BudgetTable
            budgets={rows}
            loading={loading}
            onView={(budget) => openForm("view", budget)}
            onEdit={(budget) => openForm("edit", budget)}
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

      <BudgetForm
        key={formState.session}
        open={formState.open}
        onOpenChange={(open) => setFormState((state) => ({ ...state, open }))}
        mode={formState.mode}
        budget={formState.budget}
        categories={expenseCategories}
        budgets={budgetItems}
        years={getYearOptions()}
        onSubmit={(values) => void handleFormSubmit(values)}
      />

      <DeleteBudgetDialog
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

function BudgetStat({
  label,
  value,
  loading,
  progress,
}: {
  label: string;
  value: string;
  loading: boolean;
  progress?: number;
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <p className="text-lg font-semibold tracking-tight">{value}</p>
        )}
        {progress !== undefined && !loading && <BudgetProgress percentage={progress} />}
      </CardContent>
    </Card>
  );
}
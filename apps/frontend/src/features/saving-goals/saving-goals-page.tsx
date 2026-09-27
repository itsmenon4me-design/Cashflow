"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Plus, Target } from "lucide-react";
import type { SavingGoalFormMode } from "@/components/saving-goals/SavingGoalForm";
// Form + delete dialog (react-hook-form + zod) load in async chunks the first
// time the user opens them — keeps them out of the initial page bundle.
import { LoadOnOpen } from "@/components/common/load-on-open";
const LazySavingGoalForm = dynamic(
  () => import("@/components/saving-goals/SavingGoalForm").then((m) => m.SavingGoalForm),
  { ssr: false },
);
const LazyDeleteSavingGoalDialog = dynamic(
  () =>
    import("@/components/saving-goals/DeleteSavingGoalDialog").then(
      (m) => m.DeleteSavingGoalDialog,
    ),
  { ssr: false },
);
import { SavingGoalFilters } from "@/components/saving-goals/SavingGoalFilters";
import { SavingGoalTable } from "@/components/saving-goals/SavingGoalTable";
import { SavingGoalToolbar } from "@/components/saving-goals/SavingGoalToolbar";
import { ErrorState } from "@/components/states/ErrorState";
import { Button } from "@/components/ui/button";
import { TransactionPagination } from "@/components/transactions/TransactionPagination";
import { DEFAULT_PAGE_SIZE, EMPTY_FILTERS } from "@/features/saving-goals/constants";
import type { SavingGoalFiltersState } from "@/features/saving-goals/types";
import type { SavingGoalFormValues } from "@/features/saving-goals/schema";
import { uiText } from "@/locales";
import { categoryService } from "@/services/category.service";
import {
  savingGoalService,
  toSavingGoalItem,
  type SavingGoalItem,
} from "@/services/saving-goal.service";
import type { CategoryResponse } from "@/types/backend";

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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
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
        const [items, categories] = await Promise.all([
          savingGoalService.list(),
          categoryService.list().catch(() => [] as CategoryResponse[]),
        ]);
        if (cancelled) {
          return;
        }
        const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));
        setCategoryNames(categoryMap);
        setGoals(items.map((goal) => toSavingGoalItem(goal, categoryMap)));
        setHasLoadedOnce(true);
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
  }, [refreshKey]);

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

  const handleFormSubmit = async (values: SavingGoalFormValues) => {
    // Payload builders live in the zod schema module; import it lazily inside
    // the submit path so zod stays out of the initial page bundle.
    const { toCreateSavingGoalPayload, toUpdateSavingGoalPayload } = await import(
      "@/features/saving-goals/schema"
    );

    if (formState.mode === "edit" && formState.goal) {
      try {
        await savingGoalService.update(formState.goal.id, toUpdateSavingGoalPayload(values));
      } catch {
        // daftar tetap disinkronkan dengan state server
      }
      setRefreshKey((key) => key + 1);
      return;
    }

    try {
      await savingGoalService.create(
        toCreateSavingGoalPayload(values),
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
      await savingGoalService.remove(target.id);
    } catch {
      // daftar tetap disinkronkan dengan state server
    }
    if (visible.length === 1 && page > 1) {
      setPage((value) => value - 1);
    } else {
      setRefreshKey((key) => key + 1);
    }
  };

  const initialLoading = loading && !hasLoadedOnce;
  const isEmpty = hasLoadedOnce && !error && visible.length === 0;

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
        loading={initialLoading}
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
      ) : initialLoading ? (
        <SavingGoalResultState loading onAdd={() => openForm("create", null)} />
      ) : isEmpty ? (
        <SavingGoalResultState onAdd={() => openForm("create", null)} />
      ) : (
        <>
          <SavingGoalTable
            goals={rows}
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

      <LoadOnOpen active={formState.open || deleting !== null}>
        <LazySavingGoalForm
          key={formState.session}
          open={formState.open}
          onOpenChange={(open) => setFormState((state) => ({ ...state, open }))}
          mode={formState.mode}
          goal={formState.goal}
          categories={categoryOptions}
          onSubmit={(values) => void handleFormSubmit(values)}
        />

        <LazyDeleteSavingGoalDialog
          open={deleting !== null}
          onOpenChange={(open) => {
            if (!open) {
              setDeleting(null);
            }
          }}
          onConfirm={() => void handleConfirmDelete()}
        />
      </LoadOnOpen>
    </div>
  );
}

function SavingGoalResultState({
  loading = false,
  onAdd,
}: {
  loading?: boolean;
  onAdd: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[360px] flex-col items-center justify-center gap-4 overflow-hidden rounded-xl bg-card px-6 py-16 text-center shadow-card ring-1 ring-foreground/10"
    >
      <div
        aria-hidden="true"
        className="flex size-16 items-center justify-center rounded-2xl bg-muted"
      >
        <Target className="size-8 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h2 className="min-h-6 text-base font-semibold text-foreground">
          {loading ? uiText.common.loading : uiText.savingGoals.emptyTitle}
        </h2>
        <p className="mx-auto flex min-h-[60px] max-w-sm items-center justify-center text-sm text-muted-foreground">
          {loading ? "" : uiText.savingGoals.emptySubtitle}
        </p>
      </div>
      <div className="flex min-h-11 items-center">
        {!loading && (
          <Button type="button" className="rounded-xl" onClick={onAdd}>
            <Plus />
            {uiText.savingGoals.add}
          </Button>
        )}
      </div>
    </div>
  );
}
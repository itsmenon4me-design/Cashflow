"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Plus, Tags } from "lucide-react";
import { CategoryFilters } from "@/components/categories/CategoryFilters";
import type { CategoryFormMode } from "@/components/categories/CategoryForm";
import { CategoryTable } from "@/components/categories/CategoryTable";
import { CategoryToolbar } from "@/components/categories/CategoryToolbar";
// Form + delete dialog (react-hook-form + zod) load in async chunks the first
// time the user opens them — keeps them out of the initial page bundle.
import { LoadOnOpen } from "@/components/common/load-on-open";
const LazyCategoryForm = dynamic(
  () => import("@/components/categories/CategoryForm").then((m) => m.CategoryForm),
  { ssr: false },
);
const LazyDeleteCategoryDialog = dynamic(
  () => import("@/components/categories/DeleteCategoryDialog").then((m) => m.DeleteCategoryDialog),
  { ssr: false },
);
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionPagination } from "@/components/transactions/TransactionPagination";
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_FILTERS,
} from "@/features/categories/constants";
import type { CategoryFiltersState } from "@/features/categories/types";
import type { CategoryFormValues } from "@/features/categories/schema";
import { uiText } from "@/locales";
import { categoryLabel } from "@/lib/categories";
import {
  categoryService,
  toCategoryItem,
  type CategoryItem,
} from "@/services/category.service";

interface FormState {
  open: boolean;
  mode: CategoryFormMode;
  category: CategoryItem | null;
  session: number;
}

function sortList(list: CategoryItem[], sort: CategoryFiltersState["sort"]): CategoryItem[] {
  const arr = [...list];
  switch (sort) {
    case "name_asc":
      arr.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "name_desc":
      arr.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case "created_desc":
      arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
    case "created_asc":
      arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      break;
  }
  return arr;
}

export function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [filters, setFilters] = useState<CategoryFiltersState>(EMPTY_FILTERS);
  const [incomePage, setIncomePage] = useState(1);
  const [expensePage, setExpensePage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [formState, setFormState] = useState<FormState>({
    open: false,
    mode: "create",
    category: null,
    session: 0,
  });
  const [deleting, setDeleting] = useState<CategoryItem | null>(null);

  const fetchCategories = useCallback(async () => {
    const data = await categoryService.list();
    return data.map(toCategoryItem);
  }, []);

  const load = useCallback(async () => {
    try {
      setCategories(await fetchCategories());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [fetchCategories]);

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
        const items = await fetchCategories();
        if (!cancelled) {
          setCategories(items);
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
  }, [fetchCategories]);

  const { incomeSorted, expenseSorted } = useMemo(() => {
    const keyword = filters.search.trim().toLowerCase();
    const matches = (category: CategoryItem) =>
      keyword === "" ||
      category.name.toLowerCase().includes(keyword) ||
      // the UI displays Indonesian labels — searching by what the user sees
      // ("Gaji", "Makanan") must match, not just the internal English name
      categoryLabel(category.name).toLowerCase().includes(keyword) ||
      (category.description?.toLowerCase().includes(keyword) ?? false);

    return {
      incomeSorted: sortList(
        categories.filter((c) => c.type === "INCOME" && matches(c)),
        filters.sort,
      ),
      expenseSorted: sortList(
        categories.filter((c) => c.type === "EXPENSE" && matches(c)),
        filters.sort,
      ),
    };
  }, [categories, filters]);

  const incomeTotalPages = Math.max(1, Math.ceil(incomeSorted.length / pageSize));
  const expenseTotalPages = Math.max(1, Math.ceil(expenseSorted.length / pageSize));
  const currentIncomePage = Math.min(incomePage, incomeTotalPages);
  const currentExpensePage = Math.min(expensePage, expenseTotalPages);
  const incomeRows = incomeSorted.slice(
    (currentIncomePage - 1) * pageSize,
    currentIncomePage * pageSize,
  );
  const expenseRows = expenseSorted.slice(
    (currentExpensePage - 1) * pageSize,
    currentExpensePage * pageSize,
  );

  const handleFiltersChange = (nextFilters: CategoryFiltersState) => {
    setFilters(nextFilters);
    setIncomePage(1);
    setExpensePage(1);
  };

  const handleResetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setIncomePage(1);
    setExpensePage(1);
  };

  const handlePageSizeChange = (nextPageSize: number) => {
    setPageSize(nextPageSize);
    setIncomePage(1);
    setExpensePage(1);
  };

  const openForm = (mode: CategoryFormMode, category: CategoryItem | null) => {
    setActionError(false);
    setFormState((state) => ({
      open: true,
      mode,
      category,
      session: state.session + 1,
    }));
  };

  const handleFormSubmit = async (values: CategoryFormValues) => {
    // Payload builders live in the zod schema module; import it lazily inside
    // the submit path so zod stays out of the initial page bundle.
    const { toCreateCategoryPayload, toUpdateCategoryPayload } = await import(
      "@/features/categories/schema"
    );

    if (formState.mode === "edit" && formState.category) {
      try {
        await categoryService.update(
          formState.category.id,
          toUpdateCategoryPayload(values),
        );
        setActionError(false);
      } catch {
        setActionError(true);
      }
      void load();
      return;
    }

    try {
      await categoryService.create(toCreateCategoryPayload(values));
      setActionError(false);
    } catch {
      setActionError(true);
    }
    setIncomePage(1);
    setExpensePage(1);
    void load();
  };

  const handleConfirmDelete = async () => {
    if (!deleting) {
      return;
    }
    const target = deleting;
    setDeleting(null);
    try {
      await categoryService.remove(target.id);
      setActionError(false);
    } catch {
      setActionError(true);
    }

    if (target.type === "INCOME") {
      if (incomeSorted.length === 1 && incomePage > 1) {
        setIncomePage((value) => value - 1);
      } else {
        void load();
      }
    } else if (expenseSorted.length === 1 && expensePage > 1) {
      setExpensePage((value) => value - 1);
    } else {
      void load();
    }
  };

  const isEmpty = !loading && !error && categories.length === 0;
  const filteredCount = incomeSorted.length + expenseSorted.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {uiText.categories.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {uiText.categories.subtitle}
        </p>
      </div>

      {actionError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <span>{uiText.categories.actionError}</span>
          <button
            type="button"
            className="shrink-0 font-medium underline-offset-2 hover:underline"
            onClick={() => setActionError(false)}
            aria-label={uiText.common.closeAriaLabel}
          >
            ✕
          </button>
        </div>
      )}

      <CategoryToolbar
        count={filteredCount}
        loading={loading}
        onAdd={() => openForm("create", null)}
      />

      <CategoryFilters
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
          title={uiText.categories.emptyTitle}
          description={uiText.categories.emptySubtitle}
          icon={<Tags className="size-8 text-muted-foreground" aria-hidden="true" />}
          actionButton={
            <Button type="button" className="rounded-xl" onClick={() => openForm("create", null)}>
              <Plus />
              {uiText.categories.add}
            </Button>
          }
        />
      ) : (
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <CategoryPanel
            title={uiText.transactions.typeIncome}
            count={incomeSorted.length}
            loading={loading}
            empty={incomeSorted.length === 0}
            categories={incomeRows}
            emptyAction={() => openForm("create", null)}
            onView={(category) => openForm("view", category)}
            onEdit={(category) => openForm("edit", category)}
            onDelete={setDeleting}
          >
            <TransactionPagination
              page={currentIncomePage}
              pageSize={pageSize}
              totalItems={incomeSorted.length}
              onPageChange={setIncomePage}
              onPageSizeChange={handlePageSizeChange}
            />
          </CategoryPanel>

          <CategoryPanel
            title={uiText.transactions.typeExpense}
            count={expenseSorted.length}
            loading={loading}
            empty={expenseSorted.length === 0}
            categories={expenseRows}
            emptyAction={() => openForm("create", null)}
            onView={(category) => openForm("view", category)}
            onEdit={(category) => openForm("edit", category)}
            onDelete={setDeleting}
          >
            <TransactionPagination
              page={currentExpensePage}
              pageSize={pageSize}
              totalItems={expenseSorted.length}
              onPageChange={setExpensePage}
              onPageSizeChange={handlePageSizeChange}
            />
          </CategoryPanel>
        </section>
      )}

      <LoadOnOpen active={formState.open || deleting !== null}>
        <LazyCategoryForm
          key={formState.session}
          open={formState.open}
          onOpenChange={(open) => setFormState((state) => ({ ...state, open }))}
          mode={formState.mode}
          category={formState.category}
          categories={categories}
          onSubmit={(values) => void handleFormSubmit(values)}
        />

        <LazyDeleteCategoryDialog
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

interface CategoryPanelProps {
  title: string;
  count: number;
  loading: boolean;
  empty: boolean;
  categories: CategoryItem[];
  emptyAction: () => void;
  onView: (category: CategoryItem) => void;
  onEdit: (category: CategoryItem) => void;
  onDelete: (category: CategoryItem) => void;
  children: React.ReactNode;
}

function CategoryPanel({
  title,
  count,
  loading,
  empty,
  categories,
  emptyAction,
  onView,
  onEdit,
  onDelete,
  children,
}: CategoryPanelProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>{title}</CardTitle>
        <span className="text-sm text-muted-foreground">{count}</span>
      </CardHeader>
      <CardContent className="space-y-4">
        {empty && !loading ? (
          <EmptyState
            title={uiText.categories.emptyTitle}
            description={uiText.categories.emptySubtitle}
            icon={<Tags className="size-6 text-muted-foreground" aria-hidden="true" />}
            className="py-8"
            actionButton={
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={emptyAction}
              >
                <Plus />
                {uiText.categories.add}
              </Button>
            }
          />
        ) : (
          <>
            <CategoryTable
              categories={categories}
              loading={loading}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
            />
            {/* Reserve pagination height during loading so data arrival never shifts layout */}
            {loading ? <div aria-hidden className="h-[60px]" /> : children}
          </>
        )}
      </CardContent>
    </Card>
  );
}
"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname } from 'next/navigation';
import { CirclePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { uiText } from "@/locales";
import { syncCreateTransaction } from "@/lib/offline/sync-client";
import { categoryService } from "@/services/category.service";
import {
  toCreateTransactionPayload,
  type CreateTransactionPayload,
} from "@/services/transaction.service";
import { useDataRefreshStore } from "@/stores/refresh.store";
import type { CategoryResponse } from "@/types/backend";
import type { TransactionFormValues } from "@/features/transactions/schema";

type NameLookup = Record<string, string>;
type CategoryTypeLookup = Record<string, ("INCOME" | "EXPENSE")[]>;

function buildCategoryTypes(
  categories: CategoryResponse[],
): CategoryTypeLookup {
  const lookup: CategoryTypeLookup = {};
  for (const category of categories) {
    (lookup[category.name] ??= []).push(category.type);
  }
  return lookup;
}

export function QuickAddTransaction() {
  const pathname = usePathname();
  const clientPath = typeof window !== 'undefined' ? window.location.pathname : pathname;
  const controlledType: "income" | "expense" | undefined = clientPath?.startsWith('/incomes') ? 'income' : clientPath?.startsWith('/expenses') ? 'expense' : undefined;
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [lookupsReady, setLookupsReady] = useState(false);
  const bumpRefresh = useDataRefreshStore((state) => state.bump);

  const initialValues = useMemo<Partial<TransactionFormValues>>(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return { date: `${d.getFullYear()}-${mm}-${dd}` };
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen && !lookupsReady) {
        void categoryService.list().catch(() => [] as CategoryResponse[]).then((cats) => {
          setCategories(cats);
          setLookupsReady(true);
        });
      }
    },
    [lookupsReady],
  );

  const categoryNames = useMemo<NameLookup>(
    () => Object.fromEntries(categories.map((category) => [category.id, category.name])),
    [categories],
  );
  const categoryTypes = useMemo(
    () => buildCategoryTypes(categories),
    [categories],
  );

  const categoryOptions = useMemo(
    () => [...new Set(Object.values(categoryNames))].sort(),
    [categoryNames],
  );

  const handleSubmit = useCallback(
    async (values: TransactionFormValues) => {
      const payload = toCreateTransactionPayload(
        values,
        categoryNames,
        controlledType,
      ) as CreateTransactionPayload | null;
      if (!payload) {
        throw new Error("Invalid category");
      }
      await syncCreateTransaction(payload);
      bumpRefresh();
    },
    [categoryNames, controlledType, bumpRefresh],
  );

  return (
    <>
      <Button
        variant="ghost"
        className="size-11 shrink-0 rounded-xl sm:inline-flex sm:size-auto sm:gap-2 sm:rounded-xl sm:px-3"
        onClick={() => handleOpenChange(true)}
        aria-label={uiText.common.quickAdd}
        title={uiText.common.quickAdd}
      >
        <CirclePlus className="size-5" />
        <span className="hidden sm:inline">{uiText.common.quickAdd}</span>
      </Button>

      <TransactionForm
        key="quick-add"
        open={open}
        onOpenChange={handleOpenChange}
        mode="create"
        transaction={null}
        categories={categoryOptions}
        categoryTypes={categoryTypes}
        initialValues={initialValues}
        transactionType={controlledType}
        onSubmit={handleSubmit}
      />
    </>
  );
}
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
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
import { useAddTransactionStore } from "@/stores/add-transaction.store";
import { useTimezoneStore } from "@/stores/timezone.store";
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

interface QuickAddTransactionProps {
  showTrigger?: boolean;
}

export function QuickAddTransaction({ showTrigger = true }: QuickAddTransactionProps) {
  const pathname = usePathname();
  const clientPath = typeof window !== 'undefined' ? window.location.pathname : pathname;
  const controlledType: "income" | "expense" | undefined = clientPath?.startsWith('/incomes') ? 'income' : clientPath?.startsWith('/expenses') ? 'expense' : undefined;
  const open = useAddTransactionStore((state) => state.open);
  const openDialog = useAddTransactionStore((state) => state.openDialog);
  const closeDialog = useAddTransactionStore((state) => state.closeDialog);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [lookupStatus, setLookupStatus] = useState<"loading" | "ready" | "error">("loading");
  const [lookupAttempt, setLookupAttempt] = useState(0);
  const bumpRefresh = useDataRefreshStore((state) => state.bump);
  const timeZone = useTimezoneStore((state) => state.timezone);

  useEffect(() => {
    if (!open || lookupStatus === "ready" || lookupStatus === "error") return;

    let cancelled = false;
    void categoryService
      .list()
      .then((cats) => {
        if (cancelled) return;
        setCategories(cats);
        setLookupStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setLookupStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [lookupAttempt, lookupStatus, open]);

  const retryCategoryLookup = useCallback(() => {
    setLookupStatus("loading");
    setLookupAttempt((attempt) => attempt + 1);
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) openDialog();
      else closeDialog();
    },
    [closeDialog, openDialog],
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
        timeZone,
      ) as CreateTransactionPayload | null;
      if (!payload) {
        throw new Error("Invalid category");
      }
      await syncCreateTransaction(payload);
      bumpRefresh();
    },
    [categoryNames, controlledType, bumpRefresh, timeZone],
  );

  return (
    <>
      {showTrigger && (
        <Button
          variant="ghost"
          className="size-11 shrink-0 rounded-xl sm:inline-flex sm:size-auto sm:gap-2 sm:rounded-xl sm:px-3"
          onClick={openDialog}
          aria-label={uiText.common.quickAdd}
          title={uiText.common.quickAdd}
        >
          <CirclePlus className="size-5" />
          <span className="hidden sm:inline">{uiText.common.quickAdd}</span>
        </Button>
      )}

      <TransactionForm
        key="quick-add"
        open={open}
        onOpenChange={handleOpenChange}
        mode="create"
        transaction={null}
        categories={categoryOptions}
        categoryTypes={categoryTypes}
        transactionType={controlledType}
        categoryLookupStatus={lookupStatus === "loading" ? "loading" : lookupStatus === "error" ? "error" : undefined}
        onRetryCategories={retryCategoryLookup}
        timeZone={timeZone}
        onSubmit={handleSubmit}
      />
    </>
  );
}
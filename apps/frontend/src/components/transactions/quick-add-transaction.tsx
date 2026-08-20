"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from 'next/navigation';
import { CirclePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { uiText } from "@/locales";
import { syncCreateTransaction } from "@/lib/offline/sync-client";
import { accountService } from "@/services/account.service";
import { useDashboardCurrencyStore } from "@/stores/dashboardCurrency.store";
import { categoryService } from "@/services/category.service";
import {
  toCreateTransactionPayload,
  type CreateTransactionPayload,
} from "@/services/transaction.service";
import { useDataRefreshStore } from "@/stores/refresh.store";
import type { AccountResponse, CategoryResponse } from "@/types/backend";
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
  // Must always call the hook unconditionally (Rules of Hooks) — calling it only
  // on the server would break hydration on every non-dashboard route.
  const pathname = usePathname();
  const clientPath = typeof window !== 'undefined' ? window.location.pathname : pathname;
  const controlledType: "income" | "expense" | undefined = clientPath?.startsWith('/incomes') ? 'income' : clientPath?.startsWith('/expenses') ? 'expense' : undefined;
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [lookupsReady, setLookupsReady] = useState(false);
  const activeCurrency = useDashboardCurrencyStore((s) => s.currency);
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
        void Promise.all([
          accountService.list(activeCurrency).catch(() => [] as AccountResponse[]),
          categoryService.list().catch(() => [] as CategoryResponse[]),
        ]).then(([accs, cats]) => {
          setAccounts(accs);
          setCategories(cats);
          setLookupsReady(true);
        });
      }
    },
    [lookupsReady, activeCurrency],
  );

  // If the active dashboard currency changes, invalidate previous lookups so the
  // Quick Add will fetch accounts/categories for the new currency on next open.
  // Avoids showing stale cross-currency accounts after switching dashboards.
  useEffect(() => {
    setLookupsReady(false);
    setAccounts([]);
    setCategories([]);
  }, [activeCurrency]);

  const accountNames = useMemo<NameLookup>(
    () => Object.fromEntries(accounts.map((account) => [account.id, account.name])),
    [accounts],
  );
  const accountCurrencyByName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const account of accounts) {
      map[account.name] = account.currency;
    }
    return map;
  }, [accounts]);
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
  const accountOptions = useMemo(
    () => [...new Set(Object.values(accountNames))].sort(),
    [accountNames],
  );

  const handleSubmit = useCallback(
    async (values: TransactionFormValues) => {
      // If the quick-add is being used from an incomes/expenses route, force the transaction type
      const payload = toCreateTransactionPayload(
        values,
        accountNames,
        categoryNames,
        accountCurrencyByName,
        controlledType,
      ) as CreateTransactionPayload | null;
      if (!payload) {
        throw new Error("Invalid account or category");
      }
      await syncCreateTransaction(payload);
      bumpRefresh();
    },
    [accountNames, categoryNames, accountCurrencyByName, controlledType, bumpRefresh],
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
        accounts={accountOptions}
        accountCurrencyByName={accountCurrencyByName}
        initialValues={initialValues}
        transactionType={controlledType}
        onSubmit={handleSubmit}
      />
    </>
  );
}
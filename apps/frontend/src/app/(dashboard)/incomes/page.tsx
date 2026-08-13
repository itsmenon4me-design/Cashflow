"use client";

import { useEffect, useMemo, useState } from "react";
import { uiText } from "@/locales";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { accountService } from "@/services/account.service";
import { categoryService } from "@/services/category.service";
import { toCreateTransactionPayload } from "@/services/transaction.service";
import { syncCreateTransaction } from "@/lib/offline/sync-client";
import { useDataRefreshStore } from "@/stores/refresh.store";
import type { AccountResponse, CategoryResponse } from "@/types/backend";
import type { TransactionFormValues } from "@/features/transactions/schema";

export default function Page() {
  const bumpRefresh = useDataRefreshStore((s) => s.bump);
  const [open, setOpen] = useState(true);
  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [lookupsReady, setLookupsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [accs, cats] = await Promise.all([
        accountService.list().catch(() => [] as AccountResponse[]),
        categoryService.list().catch(() => [] as CategoryResponse[]),
      ]);
      if (cancelled) return;
      setAccounts(accs);
      setCategories(cats);
      setLookupsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const accountNames = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a.name])), [accounts]);
  const accountCurrencyByName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of accounts) map[a.name] = a.currency;
    return map;
  }, [accounts]);
  const categoryNames = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories]);
  const categoryOptions = useMemo(() => [...new Set(Object.values(categoryNames))].sort(), [categoryNames]);
  const accountOptions = useMemo(() => [...new Set(Object.values(accountNames))].sort(), [accountNames]);

  const today = (() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  })();

  const initialValues: Partial<TransactionFormValues> = { date: today, type: "income" };

  const handleSubmit = async (values: TransactionFormValues) => {
    const payload = toCreateTransactionPayload(values, accountNames, categoryNames, accountCurrencyByName) as any;
    if (!payload) {
      throw new Error("Invalid account or category");
    }
    await syncCreateTransaction(payload);
    bumpRefresh();
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{uiText.navigation.income}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{uiText.transactions.subtitle}</p>
      </div>

      <TransactionForm
        open={open}
        onOpenChange={(v) => setOpen(v)}
        mode="create"
        transaction={null}
        categories={categoryOptions}
        accounts={accountOptions}
        accountCurrencyByName={accountCurrencyByName}
        initialValues={initialValues}
        onSubmit={handleSubmit}
      />

      {!lookupsReady && <p className="text-sm text-muted-foreground">Memuat akun dan kategori...</p>}
    </div>
  );
}

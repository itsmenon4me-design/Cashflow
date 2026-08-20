"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Folder,
  Landmark,
  Lightbulb,
  Loader2,
  PieChart,
  ReceiptText,
  Search,
  Target,
  TrendingUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { categoryLabel, CATEGORY_LABELS } from "@/lib/categories";
import { toInputDate } from "@/lib/date";
import { formatCurrency, formatTransactionDate } from "@/lib/format";
import { uiText } from "@/locales";
import { accountService } from "@/services/account.service";
import { analyticsService } from "@/services/analytics.service";
import { budgetService } from "@/services/budget.service";
import { categoryService } from "@/services/category.service";
import { investmentService } from "@/services/investment.service";
import { notificationService } from "@/services/notification.service";
import { savingGoalService } from "@/services/saving-goal.service";
import { transactionService } from "@/services/transaction.service";
import { toMajorUnits } from "@/lib/money";
import type {
  AccountResponse,
  CategoryResponse,
  PaginatedTransactionResponse,
  TransactionDTO,
} from "@/types/backend";
import type { CategoryType } from "@/types/backend";

const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

interface TxResult {
  id: string;
  description: string;
  category: string;
  amount: string;
  date: string;
}

interface AccountResult {
  id: string;
  name: string;
  currency: string;
  balance: string;
}

interface CategoryResult {
  id: string;
  name: string;
  type: CategoryType;
  description: string | null;
}

interface BudgetResult {
  id: string;
  categoryName: string;
  amount: string;
  month: number;
  year: number;
}

interface SavingGoalResult {
  id: string;
  name: string;
  description: string | null;
  current: string;
  target: string;
}

interface InvestmentResult {
  id: string;
  name: string;
  platform: string;
  symbol: string | null;
  type: string;
  value: string;
}

interface NotificationResult {
  id: string;
  title: string;
  message: string;
}

interface SearchResults {
  transactions: TxResult[];
  accounts: AccountResult[];
  insights: string[];
  categories: CategoryResult[];
  budgets: BudgetResult[];
  savingGoals: SavingGoalResult[];
  investments: InvestmentResult[];
  notifications: NotificationResult[];
}

const EMPTY_RESULTS: SearchResults = {
  transactions: [],
  accounts: [],
  insights: [],
  categories: [],
  budgets: [],
  savingGoals: [],
  investments: [],
  notifications: [],
};

function insightsPeriod() {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - 11, 1);
  return { startDate: toInputDate(start), endDate: toInputDate(end) };
}

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  const normalizedQuery = debouncedQuery.trim();
  const showPanel = open && normalizedQuery.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    const q = normalizedQuery.toLowerCase();
    if (q.length < MIN_QUERY_LENGTH) {
      setResults(EMPTY_RESULTS);
      setSearched(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setSearched(false);

    const categoryTerms = new Set<string>([q]);
    for (const [name, label] of Object.entries(CATEGORY_LABELS)) {
      if (label.toLowerCase().includes(q)) categoryTerms.add(name.toLowerCase());
    }

    const run = async () => {
      const searchResults = await Promise.allSettled(
        Array.from(categoryTerms)
          .slice(0, 4)
          .map((term) => transactionService.search(term)),
      );
      const [accounts, categories, insights, budgets, savingGoals, investments, notifications] =
        await Promise.allSettled([
          accountService.list(),
          categoryService.list(),
          analyticsService.getInsights(insightsPeriod(), ""),
          budgetService.list(),
          savingGoalService.list(),
          investmentService.list(),
          notificationService.list({ limit: 50 }),
        ]);

      if (cancelled) return;

      const txResponses = searchResults
        .filter(
          (r): r is PromiseFulfilledResult<PaginatedTransactionResponse> =>
            r.status === "fulfilled",
        )
        .flatMap((r) => r.value.data);

      const categoryNames: Record<string, string> = {};
      if (categories.status === "fulfilled") {
        for (const c of categories.value) {
          categoryNames[c.id] = c.name;
        }
      }
      const accountById: Record<string, AccountResponse> = {};
      if (accounts.status === "fulfilled") {
        for (const a of accounts.value) {
          accountById[a.id] = a;
        }
      }

      const seen = new Set<string>();
      const txMerged: TransactionDTO[] = [];
      for (const dto of txResponses) {
        if (seen.has(dto.id)) continue;
        seen.add(dto.id);
        txMerged.push(dto);
      }

      const transactions: TxResult[] = txMerged.slice(0, 5).map((dto: TransactionDTO) => {
        const account = accountById[dto.account_id];
        const currency = account?.currency ?? "IDR";
        return {
          id: dto.id,
          description: dto.note ?? "-",
          category: categoryLabel(categoryNames[dto.category_id]),
          amount: formatCurrency(toMajorUnits(BigInt(dto.amount_cents), currency), currency),
          date: dto.transaction_date,
        };
      });

      const accountResults: AccountResult[] =
        accounts.status === "fulfilled"
          ? accounts.value
              .filter((a) => a.name.toLowerCase().includes(q))
              .slice(0, 5)
              .map((a) => ({
                id: a.id,
                name: a.name,
                currency: a.currency,
                balance: formatCurrency(toMajorUnits(BigInt(a.current_balance_cents), a.currency), a.currency),
              }))
          : [];

      const insightResults: string[] =
        insights.status === "fulfilled"
          ? insights.value.filter((sentence) => sentence.toLowerCase().includes(q)).slice(0, 5)
          : [];

      const categoryResults: CategoryResult[] =
        categories.status === "fulfilled"
          ? categories.value
              .filter(
                (c) =>
                  c.name.toLowerCase().includes(q) ||
                  categoryLabel(c.name).toLowerCase().includes(q) ||
                  (c.description ?? "").toLowerCase().includes(q),
              )
              .slice(0, 5)
              .map((c) => ({
                id: c.id,
                name: categoryLabel(c.name),
                type: c.type,
                description: c.description,
              }))
          : [];

      const budgetResults: BudgetResult[] =
        budgets.status === "fulfilled"
          ? budgets.value
              .filter((b) => (b.category_name ?? "").toLowerCase().includes(q))
              .slice(0, 5)
              .map((b) => {
                const currency = b.currency ?? "USD";
                return {
                  id: b.id,
                  categoryName: categoryLabel(b.category_name),
                  amount: formatCurrency(toMajorUnits(BigInt(b.budget_amount_cents), currency), currency),
                  month: b.month,
                  year: b.year,
                };
              })
          : [];

      const savingGoalResults: SavingGoalResult[] =
        savingGoals.status === "fulfilled"
          ? savingGoals.value
              .filter(
                (g) =>
                  g.name.toLowerCase().includes(q) ||
                  (g.description ?? "").toLowerCase().includes(q),
              )
              .slice(0, 5)
              .map((g) => {
                const currency = g.currency ?? "USD";
                return {
                  id: g.id,
                  name: g.name,
                  description: g.description,
                  current: formatCurrency(toMajorUnits(BigInt(g.current_amount_cents), currency), currency),
                  target: formatCurrency(toMajorUnits(BigInt(g.target_amount_cents), currency), currency),
                };
              })
          : [];

      const investmentResults: InvestmentResult[] =
        investments.status === "fulfilled"
          ? investments.value
              .filter(
                (i) =>
                  i.name.toLowerCase().includes(q) ||
                  i.platform.toLowerCase().includes(q) ||
                  (i.symbol ?? "").toLowerCase().includes(q) ||
                  i.investment_type.toLowerCase().includes(q) ||
                  (i.notes ?? "").toLowerCase().includes(q),
              )
              .slice(0, 5)
              .map((i) => {
                const currency = i.currency ?? "USD";
                return {
                  id: i.id,
                  name: i.name,
                  platform: i.platform,
                  symbol: i.symbol,
                  type: i.investment_type,
                  value: formatCurrency(toMajorUnits(BigInt(i.current_value_cents), currency), currency),
                };
              })
          : [];

      const notificationResults: NotificationResult[] =
        notifications.status === "fulfilled"
          ? notifications.value.items
              .filter(
                (n) =>
                  n.title.toLowerCase().includes(q) ||
                  n.message.toLowerCase().includes(q),
              )
              .slice(0, 5)
              .map((n) => ({
                id: n.id,
                title: n.title,
                message: n.message,
              }))
          : [];

      if (!cancelled) {
        setResults({
          transactions,
          accounts: accountResults,
          insights: insightResults,
          categories: categoryResults,
          budgets: budgetResults,
          savingGoals: savingGoalResults,
          investments: investmentResults,
          notifications: notificationResults,
        });
        setLoading(false);
        setSearched(true);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [normalizedQuery]);

  const totalCount =
    results.transactions.length +
    results.accounts.length +
    results.insights.length +
    results.categories.length +
    results.budgets.length +
    results.savingGoals.length +
    results.investments.length +
    results.notifications.length;

  const navigate = (path: string) => {
    setOpen(false);
    setQuery("");
    setDebouncedQuery("");
    router.push(path);
  };

  const submitToTransactions = () => {
    const q = query.trim();
    if (!q) return;
    navigate(`/transactions?q=${encodeURIComponent(q)}`);
  };

  const hasQuery = useMemo(() => query.trim().length >= MIN_QUERY_LENGTH, [query]);

  return (
    <div className="relative hidden w-full max-w-md flex-1 md:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        className="rounded-xl bg-card pl-9"
        placeholder={uiText.common.searchPlaceholder}
        aria-label={uiText.common.searchAriaLabel}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter") submitToTransactions();
          if (event.key === "Escape") {
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
      />

      {showPanel && (
        <>
          <div
            className="fixed inset-0 z-40"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div
            role="listbox"
            aria-label={uiText.common.searchAriaLabel}
            className="absolute top-full left-0 z-50 mt-2 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
          >
            {loading && (
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {uiText.common.loading}
              </div>
            )}

            {!loading && searched && totalCount === 0 && (
              <p className="px-4 py-4 text-sm text-muted-foreground">
                {uiText.common.noSearchResults}
              </p>
            )}

            {!loading && results.transactions.length > 0 && (
              <SearchGroup label={uiText.common.searchResultsTransactions}>
                {results.transactions.map((tx) => (
                  <button
                    key={tx.id}
                    type="button"
                    role="option"
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-accent"
                    onClick={() =>
                      navigate(
                        `/transactions?q=${encodeURIComponent(tx.description !== "-" ? tx.description : tx.category)}`,
                      )
                    }
                  >
                    <ReceiptText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {tx.description}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {tx.category} · {formatTransactionDate(tx.date)}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-medium">{tx.amount}</span>
                  </button>
                ))}
              </SearchGroup>
            )}

            {!loading && results.accounts.length > 0 && (
              <SearchGroup label={uiText.common.searchResultsAccounts}>
                {results.accounts.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    role="option"
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-accent"
                    onClick={() => navigate("/accounts")}
                  >
                    <Landmark className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {account.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {account.currency}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-medium">{account.balance}</span>
                  </button>
                ))}
              </SearchGroup>
            )}

            {!loading && results.insights.length > 0 && (
              <SearchGroup label={uiText.common.searchResultsInsights}>
                {results.insights.map((sentence, index) => (
                  <button
                    key={`${sentence.slice(0, 32)}-${index}`}
                    type="button"
                    role="option"
                    className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left hover:bg-accent"
                    onClick={() => navigate("/analytics")}
                  >
                    <Lightbulb className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="line-clamp-2 text-sm text-foreground">{sentence}</span>
                  </button>
                ))}
              </SearchGroup>
            )}

            {!loading && results.categories.length > 0 && (
              <SearchGroup label={uiText.common.searchResultsCategories}>
                {results.categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    role="option"
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-accent"
                    onClick={() => navigate("/categories")}
                  >
                    <Folder className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {category.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {category.type === "INCOME" ? uiText.common.searchIncome : uiText.common.searchExpense}
                        {category.description ? ` · ${category.description}` : ""}
                      </span>
                    </span>
                  </button>
                ))}
              </SearchGroup>
            )}

            {!loading && results.budgets.length > 0 && (
              <SearchGroup label={uiText.common.searchResultsBudgets}>
                {results.budgets.map((budget) => (
                  <button
                    key={budget.id}
                    type="button"
                    role="option"
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-accent"
                    onClick={() => navigate("/budgets")}
                  >
                    <PieChart className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {budget.categoryName}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {budget.month}/{budget.year}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-medium">{budget.amount}</span>
                  </button>
                ))}
              </SearchGroup>
            )}

            {!loading && results.savingGoals.length > 0 && (
              <SearchGroup label={uiText.common.searchResultsSavingGoals}>
                {results.savingGoals.map((goal) => (
                  <button
                    key={goal.id}
                    type="button"
                    role="option"
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-accent"
                    onClick={() => navigate("/goals")}
                  >
                    <Target className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {goal.name}
                      </span>
                      {goal.description && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {goal.description}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {goal.current} / {goal.target}
                    </span>
                  </button>
                ))}
              </SearchGroup>
            )}

            {!loading && results.investments.length > 0 && (
              <SearchGroup label={uiText.common.searchResultsInvestments}>
                {results.investments.map((investment) => (
                  <button
                    key={investment.id}
                    type="button"
                    role="option"
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-accent"
                    onClick={() => navigate("/investments")}
                  >
                    <TrendingUp className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {investment.name}
                        {investment.symbol ? ` (${investment.symbol})` : ""}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {investment.type} · {investment.platform}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-medium">{investment.value}</span>
                  </button>
                ))}
              </SearchGroup>
            )}

            {!loading && results.notifications.length > 0 && (
              <SearchGroup label={uiText.common.searchResultsNotifications}>
                {results.notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    role="option"
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-accent"
                    onClick={() => navigate("/notifications")}
                  >
                    <Bell className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {notification.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {notification.message}
                      </span>
                    </span>
                  </button>
                ))}
              </SearchGroup>
            )}

            {!loading && hasQuery && (
              <button
                type="button"
                className="w-full border-t border-border px-4 py-2.5 text-center text-sm text-primary hover:bg-accent"
                onClick={submitToTransactions}
              >
                {uiText.transactions.title} →
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SearchGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border first:border-t-0">
      <p className="px-4 pt-2.5 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}
"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Plus, TrendingUp } from "lucide-react";
// recharts-based card loads via async chunk after first paint (low-CPU friendly)
import { LazyAllocationPieCard as AllocationPieCard } from "@/components/charts/lazy-charts";
import type { InvestmentFormMode } from "@/components/investments/InvestmentForm";
// Form + delete dialog (react-hook-form + zod) load in async chunks the first
// time the user opens them — keeps them out of the initial page bundle.
import { LoadOnOpen } from "@/components/common/load-on-open";
const LazyInvestmentForm = dynamic(
  () => import("@/components/investments/InvestmentForm").then((m) => m.InvestmentForm),
  { ssr: false },
);
const LazyDeleteInvestmentDialog = dynamic(
  () =>
    import("@/components/investments/DeleteInvestmentDialog").then(
      (m) => m.DeleteInvestmentDialog,
    ),
  { ssr: false },
);
import { InvestmentFilters } from "@/components/investments/InvestmentFilters";
import { InvestmentTable } from "@/components/investments/InvestmentTable";
import { InvestmentToolbar } from "@/components/investments/InvestmentToolbar";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionPagination } from "@/components/transactions/TransactionPagination";
import { DEFAULT_PAGE_SIZE, EMPTY_FILTERS } from "@/features/investments/constants";
import type { InvestmentFiltersState } from "@/features/investments/types";
import type { InvestmentFormValues } from "@/features/investments/schema";
import { cn } from "@/lib/utils";
import { formatCurrencyCents } from "@/lib/format";
import { uiText } from "@/locales";
import { accountService } from "@/services/account.service";
import {
  investmentService,
  toInvestmentItem,
  type InvestmentItem,
  type InvestmentOverview,
} from "@/services/investment.service";
import type { AccountResponse } from "@/types/backend";

interface FormState {
  open: boolean;
  mode: InvestmentFormMode;
  item: InvestmentItem | null;
  session: number;
}

type NameLookup = Record<string, string>;

export function InvestmentsPage() {
  const [items, setItems] = useState<InvestmentItem[]>([]);
  const [overview, setOverview] = useState<InvestmentOverview | null>(null);
  const [filters, setFilters] = useState<InvestmentFiltersState>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [accountNames, setAccountNames] = useState<NameLookup>({});
  const [accountCurrencies, setAccountCurrencies] = useState<Record<string, string>>({});
  const [formState, setFormState] = useState<FormState>({
    open: false,
    mode: "create",
    item: null,
    session: 0,
  });
  const [deleting, setDeleting] = useState<InvestmentItem | null>(null);

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
        const [list, overviewResult, accounts] = await Promise.all([
          investmentService.list(),
          investmentService.overview(),
          accountService.list().catch(() => [] as AccountResponse[]),
        ]);
        if (cancelled) {
          return;
        }
        const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
        setAccountNames(accountMap);
        setAccountCurrencies(
          Object.fromEntries(accounts.map((a) => [a.id, a.currency])),
        );
        setItems(list.map((item) => toInvestmentItem(item, accountMap)));
        setOverview(overviewResult);
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
    const list = items.filter(
      (item) =>
        (filters.type === "all" || item.type === filters.type) &&
        (filters.status === "all" || item.status === filters.status) &&
        (keyword === "" ||
          item.name.toLowerCase().includes(keyword) ||
          item.platform.toLowerCase().includes(keyword) ||
          (item.symbol?.toLowerCase().includes(keyword) ?? false)),
    );
    const arr = [...list];
    switch (filters.sort) {
      case "name_asc":
        arr.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name_desc":
        arr.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "value_desc":
        arr.sort((a, b) => b.currentValue - a.currentValue);
        break;
      case "value_asc":
        arr.sort((a, b) => a.currentValue - b.currentValue);
        break;
      case "pl_desc":
        arr.sort((a, b) => b.profitLoss - a.profitLoss);
        break;
      case "purchase_desc":
        arr.sort(
          (a, b) =>
            new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime(),
        );
        break;
    }
    return arr;
  }, [items, filters]);

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const rows = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const accountOptions = useMemo(
    () => Object.entries(accountNames).map(([id, name]) => ({ id, name })),
    [accountNames],
  );

  const roi = overview?.roi ?? 0;

  const handleFiltersChange = (nextFilters: InvestmentFiltersState) => {
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

  const openForm = (mode: InvestmentFormMode, item: InvestmentItem | null) => {
    setFormState((state) => ({ open: true, mode, item, session: state.session + 1 }));
  };

  const handleFormSubmit = async (values: InvestmentFormValues) => {
    // Payload builders live in the zod schema module; import it lazily inside
    // the submit path so zod stays out of the initial page bundle.
    const { toCreateInvestmentPayload, toUpdateInvestmentPayload } = await import(
      "@/features/investments/schema"
    );

    if (formState.mode === "edit" && formState.item) {
      try {
        await investmentService.update(
          formState.item.id,
          toUpdateInvestmentPayload(values),
        );
      } catch {
        // daftar tetap disinkronkan dengan state server
      }
      setRefreshKey((key) => key + 1);
      return;
    }

    try {
      await investmentService.create(
        toCreateInvestmentPayload(values),
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
      await investmentService.remove(target.id);
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
  const profitLoss = overview
    ? BigInt(overview.totalProfit) - BigInt(overview.totalLoss)
    : BigInt(0);
  const plPositive = profitLoss >= BigInt(0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {uiText.investments.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{uiText.investments.subtitle}</p>
      </div>

      <InvestmentToolbar
        count={visible.length}
        loading={loading}
        onAdd={() => openForm("create", null)}
      />

      <InvestmentFilters
        filters={filters}
        onChange={handleFiltersChange}
        onReset={handleResetFilters}
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InvestmentStat
          label={uiText.investments.totalInvested}
          value={formatCurrencyCents(overview?.totalInvested ?? "0")}
          loading={loading}
        />
        <InvestmentStat
          label={uiText.investments.currentValue}
          value={formatCurrencyCents(overview?.totalValue ?? "0")}
          loading={loading}
        />
        <InvestmentStat
          label={uiText.investments.profitLoss}
          value={formatCurrencyCents(profitLoss)}
          loading={loading}
          tone={plPositive ? "profit" : "loss"}
        />
        <InvestmentStat
          label={uiText.investments.roi}
          value={`${roi.toFixed(1)}%`}
          loading={loading}
          tone={roi >= 0 ? "profit" : "loss"}
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
            title={uiText.investments.emptyTitle}
            description={uiText.investments.emptySubtitle}
            icon={<TrendingUp className="size-8 text-muted-foreground" aria-hidden="true" />}
            actionButton={
              <Button type="button" className="rounded-xl" onClick={() => openForm("create", null)}>
                <Plus />
                {uiText.investments.add}
              </Button>
            }
          />
        ) : (
          <>
            <InvestmentTable
              items={rows}
              loading={loading}
              onView={(item) => openForm("view", item)}
              onEdit={(item) => openForm("edit", item)}
              onDelete={setDeleting}
            />
            {!loading && (
              <TransactionPagination
                page={currentPage}
                pageSize={pageSize}
                totalItems={visible.length}
                onPageChange={setPage}
                onPageSizeChange={handlePageSizeChange}
              />
            )}
          </>
        )}

      <AllocationPieCard allocation={overview?.allocation ?? []} />

      <LoadOnOpen active={formState.open || deleting !== null}>
        <LazyInvestmentForm
          key={formState.session}
          open={formState.open}
          onOpenChange={(open) => setFormState((state) => ({ ...state, open }))}
          mode={formState.mode}
          item={formState.item}
          accounts={accountOptions}
          accountCurrencies={accountCurrencies}
          onSubmit={(values) => void handleFormSubmit(values)}
        />

        <LazyDeleteInvestmentDialog
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

function InvestmentStat({
  label,
  value,
  loading,
  tone,
}: {
  label: string;
  value: string;
  loading: boolean;
  tone?: "profit" | "loss";
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <p
            className={cn(
              "text-lg font-semibold tracking-tight",
              tone === "profit" && "text-emerald-500",
              tone === "loss" && "text-red-500"
            )}
          >
            {value}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

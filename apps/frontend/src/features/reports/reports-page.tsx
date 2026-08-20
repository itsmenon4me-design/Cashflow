"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Download, Loader2, ReceiptText } from "lucide-react";
import {
  CategoryBreakdownCard,
  type CategorySlice,
} from "@/components/reports/category-breakdown-card";
import { CashflowTrendChart } from "@/components/reports/cashflow-trend-chart";
import { ReportPeriodFilter } from "@/components/reports/report-period-filter";
import { SummaryCard } from "@/components/reports/summary-card";
import { TopCategoriesCard } from "@/components/reports/top-categories-card";
import { TransactionSummaryCard } from "@/components/reports/transaction-summary-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { IncomeExpenseChartCard } from "@/components/dashboard/income-expense-chart-card";
import { computeRange, pickTrendType, previousRange, type PeriodKey, type ReportRange } from "@/features/reports/period";
import { formatMoney } from "@/lib/format";
import { categoryLabel } from "@/lib/categories";
import { uiText } from "@/locales";
import { accountService } from "@/services/account.service";
import { useDashboardCurrencyStore } from "@/stores/dashboardCurrency.store";
import { categoryService } from "@/services/category.service";
import { fromCents, downloadExport, reportService, type CategoryBreakdownResult, type ExportFormat, type ReportSummary, type TrendPoint } from "@/services/report.service";
import { toTransactionItem, transactionService } from "@/services/transaction.service";
import type { AccountResponse, CategoryResponse } from "@/types/backend";
import type { FlowPoint, TransactionItem } from "@/types/dashboard";

function toDateInputValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function pctChange(
  current: number,
  previous: number | null | undefined
): { text: string; positive: boolean } | null {
  if (previous === null || previous === undefined || previous <= 0) {
    return current > 0 ? { text: "baru", positive: true } : null;
  }
  const diff = (current - previous) / previous * 100;
  const sign = diff >= 0 ? "+" : "−";
  return { text: `${sign}${Math.abs(diff).toFixed(1)}%`, positive: diff >= 0 };
}

export function ReportsPage() {
  const [periodKey, setPeriodKey] = useState<PeriodKey>("thisMonth");
  const activeCurrency = useDashboardCurrencyStore((s) => s.currency);
  const [range, setRange] = useState<ReportRange>(() => computeRange("thisMonth"));
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [prevSummary, setPrevSummary] = useState<ReportSummary | null>(null);
  const [incomeBreakdown, setIncomeBreakdown] = useState<CategoryBreakdownResult | null>(null);
  const [expenseBreakdown, setExpenseBreakdown] = useState<CategoryBreakdownResult | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  // Non-hook access to current display currency for formatting (matches analytics pattern)
  const displayCurrency = useDashboardCurrencyStore.getState().currency;

  const applyPeriod = (key: PeriodKey) => {
    setPeriodKey(key);
    if (key !== "custom") {
      setRange(computeRange(key));
    } else {
      setCustomStart(toDateInputValue(range.startDate));
      setCustomEnd(toDateInputValue(range.endDate));
    }
  };

  const applyCustom = () => {
    if (!customStart || !customEnd) return;
    const start = new Date(customStart);
    const end = new Date(customEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
    if (start.getTime() > end.getTime()) return;
    end.setHours(23, 59, 59, 999);
    setRange({ startDate: start.toISOString(), endDate: end.toISOString() });
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      setError(false);

      try {
        const trendType = pickTrendType(range);
        const prev = previousRange(range);

        const activeCurrency = useDashboardCurrencyStore.getState().currency;
        const [summaryRes, incomeRes, expenseRes, trendRes, txRes, accounts, categories] =
          await Promise.all([
            reportService.getSummary(range, activeCurrency),
            reportService.getCategoryBreakdown("income", range, activeCurrency),
            reportService.getCategoryBreakdown("expense", range, activeCurrency),
            reportService.getCashflowTrend(trendType, range, activeCurrency),
            transactionService.list({
              fromDate: range.startDate,
              toDate: range.endDate,
              limit: 8,
              sortBy: "date",
              sortOrder: "desc",
              currency: activeCurrency,
            }),
            accountService.list(activeCurrency).catch(() => [] as AccountResponse[]),
            categoryService.list().catch(() => [] as CategoryResponse[]),
          ]);

        let prevSummaryRes: ReportSummary | null = null;
        try {
          prevSummaryRes = await reportService.getSummary(prev, activeCurrency);
        } catch {
          prevSummaryRes = null;
        }

        if (cancelled) return;

        const accNames = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
        const accCurrencies = Object.fromEntries(accounts.map((a) => [a.id, a.currency]));
        const catNames = Object.fromEntries(categories.map((c) => [c.id, c.name]));

        setSummary(summaryRes);
        setPrevSummary(prevSummaryRes);
        setIncomeBreakdown(incomeRes);
        setExpenseBreakdown(expenseRes);
        setTrend(trendRes.data ? trendRes.data : []);
        setTransactions(txRes.data.map((dto) => toTransactionItem(dto, accNames, catNames, accCurrencies)));
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, range, activeCurrency]);

  const hasAnyData = (summary?.summary.transactions ?? 0) > 0 || trend.length > 0;
  const isEmpty = !loading && !error && !hasAnyData;

  const income = summary ? fromCents(summary.summary.income, displayCurrency) : 0;
  const expense = summary ? fromCents(summary.summary.expense, displayCurrency) : 0;
  const net = summary ? fromCents(summary.summary.netCashFlow, displayCurrency) : 0;
  const txCount = summary ? summary.summary.transactions : 0;

  const incomeChange = pctChange(income, prevSummary ? fromCents(prevSummary.summary.income, displayCurrency) : null);
  const expenseChange = pctChange(expense, prevSummary ? fromCents(prevSummary.summary.expense, displayCurrency) : null);
  const netChange = pctChange(net, prevSummary ? fromCents(prevSummary.summary.netCashFlow, displayCurrency) : null);
  const txChange = pctChange(txCount, prevSummary ? prevSummary.summary.transactions : null);

  const cashFlow = useMemo<FlowPoint[]>(
    () =>
      trend.map((t) => ({
        month: t.period,
        income: Number(t.income),
        expense: Number(t.expense),
      })),
    [trend]
  );

  const incomeSlices = useMemo<CategorySlice[]>(
    () =>
      (incomeBreakdown?.categories ?? []).map((c) => ({
        name: categoryLabel(c.categoryName ?? "-"),
        value: c.percentage,
        amount: fromCents(c.totalAmount, displayCurrency),
      })),
    [incomeBreakdown]
  );

  const expenseSlices = useMemo<CategorySlice[]>(
    () =>
      (expenseBreakdown?.categories ?? []).map((c) => ({
        name: categoryLabel(c.categoryName ?? "-"),
        value: c.percentage,
        amount: fromCents(c.totalAmount, displayCurrency),
      })),
    [expenseBreakdown]
  );

  const topExpense = useMemo(() => {
    if (!summary) return [];
    const expenseTotal = BigInt(summary.summary.expense);
    const zero = BigInt(0);
    return summary.topExpenseCategories.map((c) => {
      const categoryTotal = BigInt(c.total);
      return {
        name: c.name ?? "-",
        amount: fromCents(categoryTotal, displayCurrency),
        percentage: expenseTotal > zero ? (Number(categoryTotal) / Number(expenseTotal)) * 100 : 0,
        transactionCount: 0,
      };
    });
  }, [summary]);

  const refresh = () => setRefreshKey((k) => k + 1);

  const handleExport = async (format: ExportFormat) => {
    const start = new Date(range.startDate);
    setExporting(format);
    setExportError(null);
    try {
      const res = await reportService.exportReport({
        type: "monthly",
        format,
        month: start.getMonth() + 1,
        year: start.getFullYear(),
        currency: activeCurrency,
      });
      downloadExport(res);
    } catch {
      setExportError(uiText.reports.exportError);
    } finally {
      setExporting(null);
    }
  };

  const exportBusy = exporting !== null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {uiText.reports.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{uiText.reports.subtitle}</p>
      </div>

      <ReportPeriodFilter
        value={periodKey}
        range={range}
        loading={loading}
        customStart={customStart}
        customEnd={customEnd}
        onPeriodChange={applyPeriod}
        onCustomStartChange={setCustomStart}
        onCustomEndChange={setCustomEnd}
        onApplyCustom={applyCustom}
      />

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <p className="text-sm font-medium text-foreground">{uiText.reports.exportLabel}</p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => void handleExport("csv")}
            disabled={exportBusy}
            aria-label={uiText.reports.downloadCsv}
          >
            {exporting === "csv" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="size-4" aria-hidden="true" />
            )}
            {exporting === "csv" ? uiText.reports.downloading : uiText.reports.downloadCsv}
          </Button>
        </div>
        {exportError && (
          <p className="w-full text-xs text-red-500" role="alert">
            {exportError}
          </p>
        )}
      </div>

      {error ? (
        <ErrorState title={uiText.states.errorTitle} description={uiText.states.errorDescription} onRetry={refresh} />
      ) : isEmpty ? (
        <EmptyState
          title={uiText.reports.emptyTitle}
          description={uiText.reports.emptySubtitle}
          icon={<ArrowUpRight className="size-8 text-muted-foreground" aria-hidden="true" />}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label={uiText.reports.totalIncome}
              value={formatMoney(income)}
              icon={ArrowUpRight}
              change={incomeChange?.text}
              positive={incomeChange?.positive}
              subtitle={uiText.reports.previousPeriod}
              loading={loading}
            />
            <SummaryCard
              label={uiText.reports.totalExpense}
              value={formatMoney(expense)}
              icon={ArrowDownRight}
              change={expenseChange?.text}
              positive={expenseChange?.positive}
              subtitle={uiText.reports.previousPeriod}
              loading={loading}
            />
            <SummaryCard
              label={uiText.reports.netCashFlow}
              value={formatMoney(net)}
              icon={ArrowUpRight}
              change={netChange?.text}
              positive={netChange?.positive}
              subtitle={uiText.reports.previousPeriod}
              loading={loading}
            />
            <SummaryCard
              label={uiText.reports.totalTransactions}
              value={txCount.toLocaleString("id-ID")}
              icon={ReceiptText}
              change={txChange?.text}
              positive={txChange?.positive}
              subtitle={uiText.reports.previousPeriod}
              loading={loading}
            />
          </div>

          <CashflowTrendChart data={trend} loading={loading} currency={activeCurrency} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <IncomeExpenseChartCard data={cashFlow} currency={activeCurrency} />
            <CategoryBreakdownCard
              title={uiText.reports.expenseByCategory}
              subtitle={uiText.reports.expenseByCategorySubtitle}
              data={expenseSlices}
              loading={loading}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TopCategoriesCard
              title={uiText.reports.topExpense}
              subtitle={uiText.reports.expenseByCategorySubtitle}
              data={topExpense}
              total={expense}
              loading={loading}
            />
            <CategoryBreakdownCard
              title={uiText.reports.incomeByCategory}
              subtitle={uiText.reports.incomeByCategorySubtitle}
              data={incomeSlices}
              loading={loading}
            />
          </div>

          <TransactionSummaryCard data={transactions} loading={loading} />
        </>
      )}
    </div>
  );
}
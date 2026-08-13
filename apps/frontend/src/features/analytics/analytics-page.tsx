"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, PieChart, ReceiptText } from "lucide-react";
import { FinancialHealthCard } from "@/components/analytics/financial-health-card";
import { InsightsCard } from "@/components/analytics/insights-card";
import { SpendingAnalysisCard } from "@/components/analytics/spending-analysis-card";
import { CashflowTrendChart } from "@/components/reports/cashflow-trend-chart";
import { CategoryBreakdownCard, type CategorySlice } from "@/components/reports/category-breakdown-card";
import { ReportPeriodFilter } from "@/components/reports/report-period-filter";
import { SummaryCard } from "@/components/reports/summary-card";
import { TopCategoriesCard, type TopCategoryItem } from "@/components/reports/top-categories-card";
import { IncomeExpenseChartCard } from "@/components/dashboard/income-expense-chart-card";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import {
  computeRange,
  pickTrendType,
  type PeriodKey,
  type ReportRange,
} from "@/features/reports/period";
import { formatMoney } from "@/lib/format";
import { uiText } from "@/locales";
import {
  analyticsService,
  type AnalyticsCashflow,
  type AnalyticsHealth,
  type AnalyticsOverview,
  type AnalyticsSpending,
  type AnalyticsTypeResult,
} from "@/services/analytics.service";
import { fromCents } from "@/services/report.service";
import type { FlowPoint } from "@/types/dashboard";

function toDateInputValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function formatChange(value: number | null): { text: string; positive: boolean } | null {
  if (value === null) return null;
  const sign = value >= 0 ? "+" : "−";
  return { text: `${sign}${Math.abs(value).toFixed(1)}%`, positive: value >= 0 };
}

function formatPoints(value: number | null): { text: string; positive: boolean } | null {
  if (value === null) return null;
  const sign = value >= 0 ? "+" : "−";
  return { text: `${sign}${Math.abs(value).toFixed(1)} pp`, positive: value >= 0 };
}

export function AnalyticsPage() {
  const [periodKey, setPeriodKey] = useState<PeriodKey>("thisMonth");
  const [range, setRange] = useState<ReportRange>(() => computeRange("thisMonth"));
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [income, setIncome] = useState<AnalyticsTypeResult | null>(null);
  const [expenses, setExpenses] = useState<AnalyticsTypeResult | null>(null);
  const [cashflow, setCashflow] = useState<AnalyticsCashflow | null>(null);
  const [spending, setSpending] = useState<AnalyticsSpending | null>(null);
  const [health, setHealth] = useState<AnalyticsHealth | null>(null);
  const [insights, setInsights] = useState<string[]>([]);

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
        const granularity = pickTrendType(range);
        const [overviewRes, incomeRes, expensesRes, cashflowRes, spendingRes, healthRes, insightsRes] =
          await Promise.all([
            analyticsService.getOverview(range),
            analyticsService.getIncome(range, granularity),
            analyticsService.getExpenses(range, granularity),
            analyticsService.getCashflow(range, granularity),
            analyticsService.getSpending(range),
            analyticsService.getFinancialHealth(range),
            analyticsService.getInsights(range),
          ]);
        if (cancelled) return;

        setOverview(overviewRes);
        setIncome(incomeRes);
        setExpenses(expensesRes);
        setCashflow(cashflowRes);
        setSpending(spendingRes);
        setHealth(healthRes);
        setInsights(insightsRes);
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
  }, [refreshKey, range]);

  const hasAnyData =
    (overview?.transactions ?? 0) > 0 ||
    (cashflow?.trend.length ?? 0) > 0 ||
    insights.length > 0;
  const isEmpty = !loading && !error && !hasAnyData;

  const incomeValue = overview ? fromCents(overview.income) : 0;
  const expenseValue = overview ? fromCents(overview.expense) : 0;
  const netValue = overview ? fromCents(overview.netCashFlow) : 0;
  const savingRate = overview?.savingRate ?? 0;
  const txCount = overview?.transactions ?? 0;

  const incomeChange = formatChange(overview?.comparison.income ?? null);
  const expenseChange = formatChange(overview?.comparison.expense ?? null);
  const netChange = formatChange(overview?.comparison.netCashFlow ?? null);
  const savingChange = formatPoints(overview?.comparison.savingRate ?? null);

  const cashFlowData = useMemo<FlowPoint[]>(
    () =>
      (cashflow?.trend ?? []).map((t) => ({
        month: t.period,
        income: fromCents(t.income),
        expense: fromCents(t.expense),
      })),
    [cashflow]
  );

  const expenseSlices = useMemo<CategorySlice[]>(
    () =>
      (expenses?.categories ?? []).map((c) => ({
        name: c.categoryName ?? "-",
        value: c.percentage,
        amount: fromCents(c.totalAmount),
      })),
    [expenses]
  );

  const topExpense = useMemo<TopCategoryItem[]>(
    () =>
      (expenses?.top ?? []).map((t) => ({
        name: t.name ?? "-",
        amount: fromCents(t.total),
        percentage: t.percentage,
        transactionCount: 0,
      })),
    [expenses]
  );

  const topIncome = useMemo<TopCategoryItem[]>(
    () =>
      (income?.top ?? []).map((t) => ({
        name: t.name ?? "-",
        amount: fromCents(t.total),
        percentage: t.percentage,
        transactionCount: 0,
      })),
    [income]
  );

  const refresh = () => setRefreshKey((key) => key + 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {uiText.analytics.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{uiText.analytics.subtitle}</p>
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

      {error ? (
        <ErrorState
          title={uiText.states.errorTitle}
          description={uiText.states.errorDescription}
          onRetry={refresh}
        />
      ) : isEmpty ? (
        <EmptyState
          title={uiText.reports.emptyTitle}
          description={uiText.reports.emptySubtitle}
          icon={<PieChart className="size-8 text-muted-foreground" aria-hidden="true" />}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryCard
              label={uiText.reports.totalIncome}
              value={formatMoney(incomeValue)}
              icon={ArrowUpRight}
              change={incomeChange?.text}
              positive={incomeChange?.positive}
              subtitle={uiText.reports.previousPeriod}
              loading={loading}
            />
            <SummaryCard
              label={uiText.reports.totalExpense}
              value={formatMoney(expenseValue)}
              icon={ArrowDownRight}
              change={expenseChange?.text}
              positive={expenseChange?.positive}
              subtitle={uiText.reports.previousPeriod}
              loading={loading}
            />
            <SummaryCard
              label={uiText.reports.netCashFlow}
              value={formatMoney(netValue)}
              icon={ArrowUpRight}
              change={netChange?.text}
              positive={netChange?.positive}
              subtitle={uiText.reports.previousPeriod}
              loading={loading}
            />
            <SummaryCard
              label={uiText.analytics.savingRate}
              value={`${savingRate.toFixed(1)}%`}
              icon={PieChart}
              change={savingChange?.text}
              positive={savingChange?.positive}
              subtitle={uiText.reports.previousPeriod}
              loading={loading}
            />
            <SummaryCard
              label={uiText.reports.totalTransactions}
              value={txCount.toLocaleString("id-ID")}
              icon={ReceiptText}
              subtitle={uiText.reports.previousPeriod}
              loading={loading}
            />
          </div>

          <CashflowTrendChart data={cashflow?.trend ?? []} loading={loading} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <IncomeExpenseChartCard data={cashFlowData} />
            <CategoryBreakdownCard
              title={uiText.analytics.categoryTitle}
              subtitle={uiText.analytics.categorySubtitle}
              data={expenseSlices}
              loading={loading}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TopCategoriesCard
              title={uiText.reports.topExpense}
              subtitle={uiText.analytics.categorySubtitle}
              data={topExpense}
              total={expenseValue}
              loading={loading}
            />
            <TopCategoriesCard
              title={uiText.reports.topIncome}
              subtitle={uiText.analytics.categorySubtitle}
              data={topIncome}
              total={incomeValue}
              loading={loading}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SpendingAnalysisCard spending={spending} loading={loading} />
            <FinancialHealthCard health={health} loading={loading} />
          </div>

          <InsightsCard insights={insights} loading={loading} />
        </>
      )}
    </div>
  );
}
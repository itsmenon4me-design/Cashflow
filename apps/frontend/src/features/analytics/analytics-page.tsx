"use client";

import { useEffect, useState } from "react";
import { CashFlowChart } from "@/components/dashboard/charts/CashFlowChart";
import { ExpenseCategoryChart } from "@/components/dashboard/charts/ExpenseCategoryChart";
import { IncomeExpenseChart } from "@/components/dashboard/charts/IncomeExpenseChart";
import { MonthlyTrendChart } from "@/components/dashboard/charts/MonthlyTrendChart";
import { RangeFilter, type RangeOption } from "@/features/analytics/range-filter";
import { SummaryPanel } from "@/features/analytics/summary-panel";
import { analyticsExpenseCategories, getAnalyticsDataset } from "@/lib/mock-data";
import { uiText } from "@/locales";
import type { AnalyticsRangeKey } from "@/types/dashboard";

const RANGE_OPTIONS: RangeOption[] = [
  { key: "7D", label: uiText.analytics.range7D },
  { key: "30D", label: uiText.analytics.range30D },
  { key: "3M", label: uiText.analytics.range3M },
  { key: "6M", label: uiText.analytics.range6M },
  { key: "1Y", label: uiText.analytics.range1Y },
  { key: "ALL", label: uiText.analytics.rangeAll },
];

const LOADING_DURATION_MS = 500;

export function AnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRangeKey>("3M");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), LOADING_DURATION_MS);
    return () => clearTimeout(timer);
  }, [range]);

  const handleRangeChange = (nextRange: AnalyticsRangeKey) => {
    setLoading(true);
    setRange(nextRange);
  };

  const dataset = getAnalyticsDataset(range);
  const unit =
    dataset.granularity === "daily" ? uiText.analytics.perDay : uiText.analytics.perMonth;
  const hasCashFlowData = dataset.cashFlow.length > 0;
  const hasCategories = analyticsExpenseCategories.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {uiText.analytics.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{uiText.analytics.subtitle}</p>
        </div>
        <RangeFilter
          options={RANGE_OPTIONS}
          value={range}
          onChange={handleRangeChange}
          ariaLabel={uiText.analytics.rangeAriaLabel}
        />
      </div>

      <SummaryPanel dataset={dataset} unit={unit} loading={loading} />

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <CashFlowChart
            data={dataset.cashFlow}
            title={uiText.analytics.cashFlowTitle}
            subtitle={uiText.analytics.cashFlowSubtitle}
            loading={loading}
            empty={!hasCashFlowData}
          />
        </div>
        <ExpenseCategoryChart
          data={analyticsExpenseCategories}
          title={uiText.analytics.categoryTitle}
          subtitle={uiText.analytics.categorySubtitle}
          totalLabel={uiText.analytics.totalExpense}
          loading={loading}
          empty={!hasCategories}
        />
        <IncomeExpenseChart
          data={dataset.cashFlow}
          title={uiText.analytics.incomeExpenseTitle}
          subtitle={uiText.analytics.incomeExpenseSubtitle}
          loading={loading}
          empty={!hasCashFlowData}
        />
        <div className="xl:col-span-2">
          <MonthlyTrendChart
            data={dataset.trend}
            title={uiText.analytics.trendTitle}
            subtitle={uiText.analytics.trendSubtitle}
            loading={loading}
            empty={!hasCashFlowData}
          />
        </div>
      </section>
    </div>
  );
}

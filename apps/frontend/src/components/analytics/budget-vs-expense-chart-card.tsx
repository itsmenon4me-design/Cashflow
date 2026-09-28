"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "@/components/common/chart-tooltip";
import { ChartCard } from "@/components/dashboard/charts/ChartCard";
import { Button } from "@/components/ui/button";
import { categoryLabel } from "@/lib/categories";
import { formatCurrency } from "@/lib/format";
import { uiText } from "@/locales";
import { analyticsService } from "@/services/analytics.service";
import { budgetService, type BudgetResponse } from "@/services/budget.service";
import type { CategoryBreakdownItem } from "@/services/report.service";
import { fromCents } from "@/services/report.service";
import type { ReportRange } from "@/features/reports/period";

export interface BudgetComparisonItem {
  categoryId: string;
  name: string;
  budget: number;
  spent: number;
}

interface FullMonthWindow {
  range: ReportRange;
  monthKeys: Set<string>;
  key: string;
}

interface BudgetVsExpenseChartCardProps {
  range: ReportRange;
  loading?: boolean;
}

export function getFullMonthWindow(range: ReportRange): FullMonthWindow | null {
  const start = new Date(range.startDate);
  const end = new Date(range.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return null;
  }

  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const lastMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  const months = new Set<string>();
  let firstFullMonth: Date | null = null;
  let lastFullMonthEnd: Date | null = null;

  while (cursor <= lastMonth) {
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const monthEnd = new Date(
      cursor.getFullYear(),
      cursor.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    if (start <= monthStart && end >= monthEnd) {
      months.add(`${cursor.getFullYear()}-${cursor.getMonth() + 1}`);
      firstFullMonth ??= monthStart;
      lastFullMonthEnd = monthEnd;
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  if (!firstFullMonth || !lastFullMonthEnd) return null;

  const fullRange = {
    startDate: firstFullMonth.toISOString(),
    endDate: lastFullMonthEnd.toISOString(),
  };
  return {
    range: fullRange,
    monthKeys: months,
    key: `${fullRange.startDate}:${fullRange.endDate}`,
  };
}

export function buildBudgetComparisonData(
  budgets: BudgetResponse[],
  categories: CategoryBreakdownItem[],
  monthKeys: Set<string>,
): BudgetComparisonItem[] {
  const items = new Map<string, BudgetComparisonItem>();

  for (const budget of budgets) {
    if (!monthKeys.has(`${budget.year}-${budget.month}`)) continue;

    const item = items.get(budget.category_id) ?? {
      categoryId: budget.category_id,
      name: categoryLabel(budget.category_name ?? "-"),
      budget: 0,
      spent: 0,
    };
    item.budget += fromCents(budget.budget_amount_cents, budget.currency);
    items.set(budget.category_id, item);
  }

  for (const category of categories) {
    const item = items.get(category.categoryId) ?? {
      categoryId: category.categoryId,
      name: categoryLabel(category.categoryName ?? "-"),
      budget: 0,
      spent: 0,
    };
    item.spent = fromCents(category.totalAmount);
    items.set(category.categoryId, item);
  }

  return [...items.values()].sort(
    (a, b) => b.spent - a.spent || b.budget - a.budget || a.name.localeCompare(b.name),
  );
}

export function BudgetVsExpenseChartCard({
  range,
  loading = false,
}: BudgetVsExpenseChartCardProps) {
  const { startDate, endDate } = range;
  const monthWindow = useMemo(
    () => getFullMonthWindow({ startDate, endDate }),
    [startDate, endDate],
  );
  const [budgets, setBudgets] = useState<BudgetResponse[]>([]);
  const [expenses, setExpenses] = useState<CategoryBreakdownItem[]>([]);
  const [loadedWindowKey, setLoadedWindowKey] = useState<string | null>(null);
  const [errorWindowKey, setErrorWindowKey] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const windowKey = monthWindow?.key ?? null;

  useEffect(() => {
    if (!monthWindow) return;

    let cancelled = false;

    void Promise.all([
      budgetService.list(),
      analyticsService.getExpenses(monthWindow.range, "monthly"),
    ])
      .then(([budgetResult, expenseResult]) => {
        if (!cancelled) {
          setBudgets(budgetResult);
          setExpenses(expenseResult.categories);
          setErrorWindowKey(null);
          setLoadedWindowKey(monthWindow.key);
        }
      })
      .catch(() => {
        if (!cancelled) setErrorWindowKey(monthWindow.key);
      });

    return () => {
      cancelled = true;
    };
  }, [monthWindow, retryKey]);

  const data = useMemo(
    () => buildBudgetComparisonData(budgets, expenses, monthWindow?.monthKeys ?? new Set()),
    [budgets, expenses, monthWindow],
  );
  const chartHeight = Math.max(240, data.length * 42);
  const requestLoading = Boolean(
    monthWindow && loadedWindowKey !== windowKey && errorWindowKey !== windowKey,
  );
  const requestError = Boolean(monthWindow && errorWindowKey === windowKey);

  return (
    <ChartCard
      title={uiText.analytics.budgetComparisonTitle}
      subtitle={uiText.analytics.budgetComparisonSubtitle}
      loading={loading || requestLoading}
      stretch
      contentClassName="h-auto min-h-[280px]"
    >
      {!monthWindow ? (
        <div className="flex h-full min-h-[260px] items-center justify-center px-5 text-center text-sm text-muted-foreground">
          {uiText.analytics.budgetComparisonNoFullMonths}
        </div>
      ) : requestError ? (
        <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-3 px-4 text-center">
          <p role="alert" className="text-sm text-muted-foreground">
            {uiText.states.errorDescription}
          </p>
          <Button type="button" variant="outline" onClick={() => setRetryKey((key) => key + 1)}>
            {uiText.common.retry}
          </Button>
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-full min-h-[260px] items-center justify-center px-5 text-center text-sm text-muted-foreground">
          {uiText.analytics.budgetComparisonNoData}
        </div>
      ) : (
        <div className="space-y-3 p-3">
          <div
            className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground"
            aria-label={`${uiText.analytics.budgetLabel}, ${uiText.analytics.spentLabel}`}
          >
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="size-2.5 rounded-sm bg-[var(--chart-5)]" />
              {uiText.analytics.budgetLabel}
            </span>
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="size-2.5 rounded-sm bg-[var(--chart-1)]" />
              {uiText.analytics.spentLabel}
            </span>
          </div>
          <div style={{ height: chartHeight }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 4, right: 12, bottom: 4, left: 0 }}
                barCategoryGap={8}
                accessibilityLayer
              >
                <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  tickFormatter={(value: number) => formatCurrency(value)}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={104}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      valueFormatter={(value) => formatCurrency(Number(value))}
                    />
                  }
                />
                <Bar
                  dataKey="budget"
                  name={uiText.analytics.budgetLabel}
                  fill="var(--chart-5)"
                  radius={[0, 3, 3, 0]}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="spent"
                  name={uiText.analytics.spentLabel}
                  fill="var(--chart-1)"
                  radius={[0, 3, 3, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </ChartCard>
  );
}

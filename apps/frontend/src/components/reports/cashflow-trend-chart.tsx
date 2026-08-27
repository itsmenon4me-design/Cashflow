"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "@/components/common/chart-tooltip";
import { ChartCard } from "@/components/dashboard/charts/ChartCard";
import CenteredEmptyState from "@/components/states/CenteredEmptyState";
import { formatCurrencyCents, formatCompactCurrency } from "@/lib/format";
import { uiText } from "@/locales";
import type { TrendPoint } from "@/services/report.service";

interface CashflowTrendChartProps {
  data: TrendPoint[];
  loading?: boolean;
  currency?: string;
}

/**
 * Series palette — reuses EXISTING app tokens only:
 * - income  → var(--chart-2) emerald  (matches transaction-tone income green)
 * - expense → var(--danger)   red     (matches transaction-tone expense red)
 * - net     → var(--info)     muted blue, dashed: it is a DERIVED aggregate,
 *                             visually quieter than its two components.
 * No gradients / glows / shadows: flat strokes consistent with the KPI cards.
 */
const SERIES = {
  income: { key: "income", stroke: "var(--chart-2)", dashed: false },
  expense: { key: "expense", stroke: "var(--danger)", dashed: false },
  net: { key: "net", stroke: "var(--info)", dashed: true },
} as const;

/** Minimum points before a trend line says anything meaningful. */
const MIN_TREND_POINTS = 3;

export function CashflowTrendChart({ data, loading = false, currency }: CashflowTrendChartProps) {
  // Backend sends cents as STRINGS; recharts needs numbers. Passing the raw
  // payload used to produce stray artifacts (e.g. a lone digit floating over
  // the plot) because string values broke the axis domain math.
  const series = useMemo(
    () =>
      data.map((point) => ({
        period: point.period,
        income: Number(point.income),
        expense: Number(point.expense),
        net: Number(point.netCashFlow),
      })),
    [data],
  );

  const legend = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {(Object.keys(SERIES) as (keyof typeof SERIES)[]).map((name) => {
        const meta = SERIES[name];
        const label =
          name === "income"
            ? uiText.reports.income
            : name === "expense"
              ? uiText.reports.expense
              : uiText.reports.net;
        return (
          <span key={meta.key} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-0.5 w-4 rounded-full"
              style={{
                backgroundColor: meta.stroke,
                ...(meta.dashed
                  ? {
                      backgroundImage: `linear-gradient(90deg, ${meta.stroke} 55%, transparent 55%)`,
                      backgroundSize: "8px 100%",
                    }
                  : {}),
              }}
            />
            {label}
          </span>
        );
      })}
    </div>
  );

  return (
    <ChartCard
      title={uiText.reports.cashFlowTrend}
      subtitle={uiText.reports.cashFlowTrendSubtitle}
      loading={loading}
      empty={!series || series.length === 0}
      actions={legend}
      contentClassName="h-72"
    >
      {series.length < MIN_TREND_POINTS ? (
        // A lone point on a giant canvas reads as broken; say so instead.
        <CenteredEmptyState
          title={uiText.reports.trendNotEnoughTitle}
          description={uiText.reports.trendNotEnoughDesc}
        />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="period"
              axisLine={false}
              tickLine={false}
              minTickGap={24}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={56}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              tickFormatter={(value) => formatCompactCurrency(Number(value), currency)}
            />
            {/* Hover-only tooltip; hidden entirely when the cursor leaves. */}
            <Tooltip
              content={<ChartTooltip valueFormatter={(value) => formatCurrencyCents(String(value), currency)} />}
              cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "4 4" }}
            />
            {(Object.keys(SERIES) as (keyof typeof SERIES)[]).map((name) => {
              const meta = SERIES[name];
              const label =
                name === "income"
                  ? uiText.reports.income
                  : name === "expense"
                    ? uiText.reports.expense
                    : uiText.reports.net;
              return (
                <Line
                  key={meta.key}
                  type="monotone"
                  dataKey={meta.key}
                  name={label}
                  stroke={meta.stroke}
                  strokeWidth={2}
                  strokeDasharray={meta.dashed ? "5 4" : undefined}
                  dot={{ r: 2.5, strokeWidth: 0, fill: meta.stroke }}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

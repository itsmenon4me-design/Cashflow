"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "@/components/common/chart-tooltip";
import { ChartCard } from "@/components/dashboard/charts/ChartCard";
import { formatCurrencyCents, formatCompactCurrency } from "@/lib/format";
import { uiText } from "@/locales";
import type { TrendPoint } from "@/services/report.service";

interface CashflowTrendChartProps {
  data: TrendPoint[];
  loading?: boolean;
  currency?: string;
}

export function CashflowTrendChart({ data, loading = false, currency }: CashflowTrendChartProps) {
  return (
    <ChartCard
      title={uiText.reports.cashFlowTrend}
      subtitle={uiText.reports.cashFlowTrendSubtitle}
      loading={loading}
      empty={!data || data.length === 0}
      contentClassName="h-72"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="reportsIncome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.35} />
              <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="reportsExpense" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-4)" stopOpacity={0.35} />
              <stop offset="95%" stopColor="var(--chart-4)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="reportsNet" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
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
          <Tooltip
            content={<ChartTooltip valueFormatter={(value) => formatCurrencyCents(String(value), currency)} />}
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "4 4" }}
          />
          <Area
            type="monotone"
            dataKey="income"
            name={uiText.reports.income}
            stroke="var(--chart-2)"
            fill="url(#reportsIncome)"
            strokeWidth={2.5}
          />
          <Area
            type="monotone"
            dataKey="expense"
            name={uiText.reports.expense}
            stroke="var(--chart-4)"
            fill="url(#reportsExpense)"
            strokeWidth={2.5}
          />
          <Area
            type="monotone"
            dataKey="netCashFlow"
            name={uiText.reports.net}
            stroke="var(--chart-1)"
            fill="url(#reportsNet)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
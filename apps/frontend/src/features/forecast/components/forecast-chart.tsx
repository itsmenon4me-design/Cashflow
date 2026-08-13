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
import { ChartCard } from "@/components/dashboard/charts/ChartCard";
import { ChartTooltip } from "@/components/common/chart-tooltip";
import { formatCurrencyCents } from "@/lib/format";
import type { ForecastResponse } from "@/types/backend";

interface ForecastChartProps {
  data: ForecastResponse | null;
  currency: string;
  loading?: boolean;
  text: {
    chartTitle: string;
    chartSubtitle: string;
    chartIncomeLabel: string;
    chartExpenseLabel: string;
    chartNetLabel: string;
  };
  locale: string;
}

function formatPeriodLabel(period: string, locale: string): string {
  const date = new Date(`${period}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return period;
  }

  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "id-ID", {
    month: "short",
    year: "numeric",
  }).format(date);
}

export function ForecastChart({ data, currency, loading = false, text, locale }: ForecastChartProps) {
  const chartData = (data?.months ?? []).map((item) => ({
    period: item.period,
    displayPeriod: formatPeriodLabel(item.period, locale),
    income: item.projectedIncomeCents,
    expense: item.projectedExpenseCents,
    net: item.projectedNetCashflowCents,
  }));

  return (
    <ChartCard
      title={text.chartTitle}
      subtitle={text.chartSubtitle}
      loading={loading}
      empty={chartData.length === 0}
      contentClassName="h-80"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="forecast-income" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="forecast-expense" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-4)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--chart-4)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="forecast-net" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="displayPeriod"
            axisLine={false}
            tickLine={false}
            minTickGap={20}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={56}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            tickFormatter={(value) =>
              Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value))
            }
          />
          <Tooltip
            content={<ChartTooltip valueFormatter={(value) => formatCurrencyCents(String(value), currency)} />}
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "4 4" }}
          />
          <Area
            type="monotone"
            dataKey="income"
            name={text.chartIncomeLabel}
            stroke="var(--chart-2)"
            fill="url(#forecast-income)"
            strokeWidth={2.5}
          />
          <Area
            type="monotone"
            dataKey="expense"
            name={text.chartExpenseLabel}
            stroke="var(--chart-4)"
            fill="url(#forecast-expense)"
            strokeWidth={2.5}
          />
          <Area
            type="monotone"
            dataKey="net"
            name={text.chartNetLabel}
            stroke="var(--chart-1)"
            fill="url(#forecast-net)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

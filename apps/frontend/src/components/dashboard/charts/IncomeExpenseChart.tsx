"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip } from "recharts";
import { ChartCard } from "@/components/dashboard/charts/ChartCard";
import { ChartXAxis, ChartYAxis } from "@/components/dashboard/charts/chart-axes";
import { renderLegendText } from "@/components/dashboard/charts/chart-legend";
import { ChartTooltip } from "@/components/common/chart-tooltip";
import { formatCurrency } from "@/lib/format";
import { uiText } from "@/locales";
import type { AnalyticsCashFlowPoint } from "@/types/dashboard";

interface IncomeExpenseChartProps {
  data: AnalyticsCashFlowPoint[];
  title: string;
  subtitle?: string;
  loading?: boolean;
  empty?: boolean;
  className?: string;
}

export function IncomeExpenseChart({
  data,
  title,
  subtitle,
  loading = false,
  empty = false,
  className,
}: IncomeExpenseChartProps) {
  return (
    <ChartCard title={title} subtitle={subtitle} loading={loading} empty={empty} className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <ChartXAxis />
          <ChartYAxis />
          <Tooltip
            content={<ChartTooltip valueFormatter={(value) => formatCurrency(Number(value))} />}
            cursor={{ fill: "var(--muted)" }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            verticalAlign="bottom"
            wrapperStyle={{ paddingTop: 8 }}
            formatter={renderLegendText}
          />
          <Bar
            dataKey="income"
            name={uiText.dashboard.income}
            fill="var(--chart-2)"
            radius={[6, 6, 0, 0]}
            maxBarSize={18}
            animationDuration={300}
            animationEasing="ease-out"
          />
          <Bar
            dataKey="expense"
            name={uiText.dashboard.expense}
            fill="var(--primary)"
            radius={[6, 6, 0, 0]}
            maxBarSize={18}
            animationDuration={300}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

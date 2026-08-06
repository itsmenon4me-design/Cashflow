"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { ChartCard } from "@/components/dashboard/charts/ChartCard";
import { ChartXAxis, ChartYAxis } from "@/components/dashboard/charts/chart-axes";
import { renderLegendText } from "@/components/dashboard/charts/chart-legend";
import { ChartTooltip } from "@/components/common/chart-tooltip";
import { formatCurrency } from "@/lib/format";
import { uiText } from "@/locales";
import type { AnalyticsCashFlowPoint } from "@/types/dashboard";

interface CashFlowChartProps {
  data: AnalyticsCashFlowPoint[];
  title: string;
  subtitle?: string;
  loading?: boolean;
  empty?: boolean;
  className?: string;
}

export function CashFlowChart({
  data,
  title,
  subtitle,
  loading = false,
  empty = false,
  className,
}: CashFlowChartProps) {
  return (
    <ChartCard title={title} subtitle={subtitle} loading={loading} empty={empty} className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <ChartXAxis />
          <ChartYAxis />
          <Tooltip
            content={<ChartTooltip valueFormatter={(value) => formatCurrency(Number(value))} />}
            cursor={{ stroke: "var(--border)" }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            verticalAlign="bottom"
            wrapperStyle={{ paddingTop: 8 }}
            formatter={renderLegendText}
          />
          <Line
            type="monotone"
            dataKey="income"
            name={uiText.dashboard.income}
            stroke="var(--chart-2)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
            animationDuration={300}
            animationEasing="ease-out"
          />
          <Line
            type="monotone"
            dataKey="expense"
            name={uiText.dashboard.expense}
            stroke="var(--primary)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
            animationDuration={300}
            animationEasing="ease-out"
          />
          <Line
            type="monotone"
            dataKey="balance"
            name={uiText.dashboard.balance}
            stroke="var(--chart-3)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
            animationDuration={300}
            animationEasing="ease-out"
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

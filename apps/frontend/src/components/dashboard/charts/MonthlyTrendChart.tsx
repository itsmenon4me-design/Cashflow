"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { ChartCard } from "@/components/dashboard/charts/ChartCard";
import { ChartXAxis, ChartYAxis } from "@/components/dashboard/charts/chart-axes";
import { renderLegendText } from "@/components/dashboard/charts/chart-legend";
import { ChartTooltip } from "@/components/common/chart-tooltip";
import { formatCurrency } from "@/lib/format";
import { uiText } from "@/locales";
import type { AnalyticsTrendPoint } from "@/types/dashboard";

interface MonthlyTrendChartProps {
  data: AnalyticsTrendPoint[];
  title: string;
  subtitle?: string;
  loading?: boolean;
  empty?: boolean;
  className?: string;
}

export function MonthlyTrendChart({
  data,
  title,
  subtitle,
  loading = false,
  empty = false,
  className,
}: MonthlyTrendChartProps) {
  return (
    <ChartCard title={title} subtitle={subtitle} loading={loading} empty={empty} className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
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
          <Area
            type="monotone"
            dataKey="value"
            name={uiText.dashboard.balance}
            stroke="var(--primary)"
            fill="url(#trendFill)"
            strokeWidth={2.5}
            animationDuration={300}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

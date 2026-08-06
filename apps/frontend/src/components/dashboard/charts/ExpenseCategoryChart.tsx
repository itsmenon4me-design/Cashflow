"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartCard } from "@/components/dashboard/charts/ChartCard";
import { CHART_COLORS, renderPieLegend } from "@/components/dashboard/charts/chart-legend";
import { ChartTooltip } from "@/components/common/chart-tooltip";
import { formatCurrency } from "@/lib/format";
import type { DistributionPoint } from "@/types/dashboard";

interface ExpenseCategoryChartProps {
  data: DistributionPoint[];
  title: string;
  subtitle?: string;
  totalLabel: string;
  loading?: boolean;
  empty?: boolean;
  className?: string;
}

export function ExpenseCategoryChart({
  data,
  title,
  subtitle,
  totalLabel,
  loading = false,
  empty = false,
  className,
}: ExpenseCategoryChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      loading={loading}
      empty={empty}
      contentClassName="h-64"
      className={className}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="55%"
            outerRadius="82%"
            paddingAngle={3}
            stroke="none"
            animationDuration={300}
            animationEasing="ease-out"
          >
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            content={<ChartTooltip valueFormatter={(value) => formatCurrency(Number(value))} />}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            verticalAlign="bottom"
            wrapperStyle={{ paddingTop: 8 }}
            formatter={renderPieLegend}
          />
          <text
            x="50%"
            y="47%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-foreground text-lg font-semibold"
          >
            {formatCurrency(total)}
          </text>
          <text
            x="50%"
            y="57%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground text-xs"
          >
            {totalLabel}
          </text>
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

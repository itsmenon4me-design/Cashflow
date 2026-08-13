"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartTooltip } from "@/components/common/chart-tooltip";
import { ChartCard } from "@/components/dashboard/charts/ChartCard";
import { CHART_COLORS } from "@/components/dashboard/charts/chart-legend";
import { formatCurrency } from "@/lib/format";

export interface CategorySlice {
  name: string;
  value: number;
  amount: number;
}

interface CategoryBreakdownCardProps {
  title: string;
  subtitle?: string;
  data: CategorySlice[];
  loading?: boolean;
}

export function CategoryBreakdownCard({
  title,
  subtitle,
  data,
  loading = false,
}: CategoryBreakdownCardProps) {
  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      loading={loading}
      empty={!data || data.length === 0}
      contentClassName="h-72"
    >
      <div className="flex h-full flex-col gap-4">
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={3}
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                content={<ChartTooltip valueFormatter={(value) => formatCurrency(Number(value))} />}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {data.map((item, index) => (
            <div key={item.name} className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
              />
              <span className="truncate text-muted-foreground">{item.name}</span>
              <span className="ml-auto truncate font-medium text-foreground">
                {formatCurrency(item.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}
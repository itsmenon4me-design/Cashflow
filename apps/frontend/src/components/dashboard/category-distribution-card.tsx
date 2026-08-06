"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartTooltip } from "@/components/common/chart-tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { uiText } from "@/locales";
import type { DistributionPoint } from "@/types/dashboard";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--border)"];

interface CategoryDistributionCardProps {
  data: DistributionPoint[];
}

export function CategoryDistributionCard({ data }: CategoryDistributionCardProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>{uiText.dashboard.categoryExpense}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={92}
                paddingAngle={3}
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip valueFormatter={(value) => `${value}%`} />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 text-sm">
          {data.map((item, index) => (
            <div key={item.name} className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="truncate text-muted-foreground">{item.name}</span>
              <span className="ml-auto font-medium text-foreground">{item.value}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

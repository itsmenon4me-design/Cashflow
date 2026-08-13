"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartTooltip } from "@/components/common/chart-tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { investmentTypeInfo } from "@/features/investments/constants";
import { formatCurrencyCents } from "@/lib/format";
import { uiText } from "@/locales";
import type { InvestmentAllocation } from "@/services/investment.service";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--border)",
];

interface AllocationPieCardProps {
  allocation: InvestmentAllocation[];
  title?: string;
  className?: string;
}

export function AllocationPieCard({
  allocation,
  title,
  className,
}: AllocationPieCardProps) {
  const data = allocation.map((item) => ({
    name: investmentTypeInfo(item.type).label,
    // Charts need a numeric coordinate; labels retain the exact minor-unit string.
    value: Number(item.total),
    minorUnits: item.total,
  }));

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title ?? uiText.investments.allocationTitle}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        {data.length === 0 ? (
          <p className="py-10 text-sm text-muted-foreground">
            {uiText.common.noDataAvailable}
          </p>
        ) : (
          <>
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
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip valueFormatter={(value) => formatCurrencyCents(String(value))} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 text-sm">
              {data.map((item, index) => (
                <div key={`legend-${index}`} className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="truncate text-muted-foreground">{item.name}</span>
                  <span className="ml-auto font-medium text-foreground">
                    {formatCurrencyCents(item.minorUnits)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

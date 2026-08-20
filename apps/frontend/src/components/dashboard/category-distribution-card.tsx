"use client";

import Link from "next/link";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartTooltip } from "@/components/common/chart-tooltip";
import { formatCurrencyCents } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { uiText } from "@/locales";
import CenteredEmptyState from "@/components/states/CenteredEmptyState";
import type { DistributionPoint } from "@/types/dashboard";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--border)"];

interface CategoryDistributionCardProps {
  data: DistributionPoint[];
  currency?: string;
}

export function CategoryDistributionCard({ data, currency }: CategoryDistributionCardProps) {
  const items = (data ?? []).slice();
  // show top 3 by amount when available, otherwise by percentage
  items.sort((a, b) => (b.amount ?? b.value) - (a.amount ?? a.value));
  const top = items.slice(0, 3);

  return (
    <Card className="shadow-sm">
      <CardHeader className="px-5">
        <CardTitle className="text-base font-semibold">{uiText.dashboard.categoryExpense}</CardTitle>
      </CardHeader>
      <CardContent className="p-5 pt-0 flex flex-col items-center gap-4">
        {(!data || data.length === 0) ? (
          <div className="h-[200px] w-full">
            <CenteredEmptyState title={(uiText as any)?.dashboard?.emptyCategory ?? uiText.common.noDataAvailable} />
          </div>
        ) : (
          <>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={items}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={92}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {items.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip valueFormatter={(value) => `${value}%`} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="w-full">
              <div className="flex flex-col gap-2 text-sm">
                {top.map((item, index) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span title={item.name} className="truncate text-sm font-medium text-foreground">{item.name}</span>
                        <span className="ml-auto text-sm text-muted-foreground">{item.value}%</span>
                      </div>
                      {typeof item.amount === 'number' ? (
                        <div className="text-sm text-muted-foreground">{formatCurrencyCents(item.amount, currency)}</div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 text-right">
                <Link href="/categories" className="text-sm text-primary hover:underline">
                  {uiText.common.viewAll}
                </Link>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "@/components/common/chart-tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyCents, formatCompactCurrency } from "@/lib/format";
import { uiText } from "@/locales";
import CenteredEmptyState from "@/components/states/CenteredEmptyState";
import type { FlowPoint } from "@/types/dashboard";

interface IncomeExpenseChartCardProps {
  data: FlowPoint[];
  currency?: string;
}

export function IncomeExpenseChartCard({ data, currency }: IncomeExpenseChartCardProps) {
  return (
    <Card className="flex h-full flex-col shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-4 px-5">
        <div>
          <CardTitle className="text-base font-semibold">{uiText.dashboard.incomeVsExpense}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{uiText.dashboard.monthlyTrend}</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          <span className="size-2 rounded-full bg-emerald-500" />
          {uiText.dashboard.income}
          <span className="ml-2 size-2 rounded-full bg-primary" />
          {uiText.dashboard.expense}
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col p-5 pt-0">
        {(!data || data.length === 0) ? (
          <div className="h-[200px] min-h-[200px] w-full flex-1 md:h-[260px] md:min-h-[260px]">
            <CenteredEmptyState title={uiText.common.noDataAvailable} />
          </div>
        ) : (
          <div className="h-[200px] min-h-[200px] w-full flex-1 md:h-[260px] md:min-h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  tickFormatter={(value) => formatCompactCurrency(Number(value), currency)}
                />
                <Tooltip
                  content={<ChartTooltip valueFormatter={(value) => formatCurrencyCents(String(value), currency)} />}
                  cursor={{ fill: "var(--muted)" }}
                />
                <Bar
                  dataKey="income"
                  name={uiText.dashboard.income}
                  fill="var(--chart-2)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={18}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="expense"
                  name={uiText.dashboard.expense}
                  fill="var(--primary)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={18}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

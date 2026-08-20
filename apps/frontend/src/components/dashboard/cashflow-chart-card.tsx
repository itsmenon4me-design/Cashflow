"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "@/components/common/chart-tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyCents, formatCompactCurrency } from "@/lib/format";
import { uiText } from "@/locales";
import type { CashFlowPoint } from "@/types/dashboard";
import CenteredEmptyState from "@/components/states/CenteredEmptyState";

interface CashflowChartCardProps {
  data: CashFlowPoint[];
  currency?: string;
}

export function CashflowChartCard({ data, currency }: CashflowChartCardProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-4 px-5">
        <div>
          <CardTitle className="text-base font-semibold">{uiText.dashboard.cashFlowMonthly}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{uiText.dashboard.monthlyTrend}</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          <span className="size-2 rounded-full bg-primary" />
          {uiText.dashboard.balance}
        </div>
      </CardHeader>
      <CardContent>
        {(!data || data.length === 0) ? (
          <div className="h-[200px] md:h-[260px] w-full">
            <CenteredEmptyState title={(uiText as any)?.dashboard?.emptyMonthlyTransactions ?? uiText.common.noDataAvailable} />
          </div>
        ) : (
          <div className="h-[200px] md:h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                  </linearGradient>
                </defs>
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
                  cursor={{ stroke: "var(--border)" }}
                />
                <Area
                  type="monotone"
                  dataKey="balance"
                  name={uiText.dashboard.balance}
                  stroke="var(--primary)"
                  fill="url(#balanceFill)"
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

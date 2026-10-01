"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type YAxisTickContentProps,
} from "recharts";
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

interface CashflowChartPoint extends CashFlowPoint {
  chartValue: number | null;
}

export function toCashflowChartData(data: CashFlowPoint[]): CashflowChartPoint[] {
  return data.map((point) => ({
    ...point,
    chartValue: point.balance === null ? null : Math.abs(point.balance),
  }));
}

function renderYAxisTick(
  { x, y, payload, tickFormatter, index }: YAxisTickContentProps,
  xOffset: number,
  fontSize: number,
) {
  const value = tickFormatter
    ? tickFormatter(payload.value, index)
    : payload.value;

  return (
    <text
      x={Number(x) + xOffset}
      y={y}
      dy="0.355em"
      textAnchor="end"
      fill="var(--muted-foreground)"
      fontSize={fontSize}
    >
      {value}
    </text>
  );
}

function CompactYAxisTick(props: YAxisTickContentProps) {
  return renderYAxisTick(props, 4, 10);
}

function StandardYAxisTick(props: YAxisTickContentProps) {
  return renderYAxisTick(props, -21, 12);
}

export function CashflowChartCard({ data, currency }: CashflowChartCardProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [isCompact, setIsCompact] = useState(false);
  const chartData = toCashflowChartData(data);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width !== undefined) {
        setIsCompact((current) => {
          const next = width < 480;
          return current === next ? current : next;
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-4 px-5">
        <div>
          <CardTitle className="text-base font-semibold">{uiText.dashboard.cashFlowMonthly}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{uiText.dashboard.monthlyTrend}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-primary" />
            {uiText.analytics.cashFlowPositive}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-destructive" />
            {uiText.analytics.cashFlowNegative}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {(!data || data.length === 0) ? (
          <div className="h-[200px] md:h-[260px] w-full">
            <CenteredEmptyState title={uiText.common.noDataAvailable} />
          </div>
        ) : (
          <div ref={chartContainerRef} className="h-[200px] md:h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{
                  top: 8,
                  right: isCompact ? 0 : 8,
                  left: 0,
                  bottom: 0,
                }}
              >
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-45}
                  height={48}
                  textAnchor="end"
                  tick={{ fill: "var(--muted-foreground)", fontSize: isCompact ? 9 : 12 }}
                />
                <YAxis
                  domain={[0, "auto"]}
                  width={isCompact ? 32 : 60}
                  tickMargin={isCompact ? 4 : 5}
                  axisLine={false}
                  tickLine={false}
                  tick={isCompact ? CompactYAxisTick : StandardYAxisTick}
                  tickFormatter={(value) => formatCompactCurrency(Number(value), currency)}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      valueFormatter={(value, entry) =>
                        formatCurrencyCents(
                          String(entry?.payload?.balance ?? value),
                          currency,
                        )
                      }
                    />
                  }
                  cursor={{ fill: "var(--accent)", opacity: 0.3 }}
                />
                <ReferenceLine y={0} stroke="var(--border)" />
                <Bar
                  dataKey="chartValue"
                  name={uiText.dashboard.cashFlow}
                  fill="var(--primary)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={56}
                  isAnimationActive={false}
                >
                  {chartData.map((point) => (
                    <Cell
                      key={point.month}
                      fill={
                        point.balance !== null && point.balance < 0
                          ? "var(--destructive)"
                          : "var(--primary)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

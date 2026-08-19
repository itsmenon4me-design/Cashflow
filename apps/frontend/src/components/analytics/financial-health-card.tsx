"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyCents } from "@/lib/format";
import { uiText } from "@/locales";
import type { AnalyticsHealth } from "@/services/analytics.service";
import { cn } from "@/lib/utils";
import { useDashboardCurrencyStore } from "@/stores/dashboardCurrency.store";

interface FinancialHealthCardProps {
  health: AnalyticsHealth | null;
  loading?: boolean;
}

const BAR_COLOR: Record<AnalyticsHealth["label"], string> = {
  healthy: "var(--chart-2)",
  moderate: "var(--chart-3)",
  risk: "var(--chart-4)",
};

function getLabelText(): Record<AnalyticsHealth["label"], string> {
  return {
    healthy: uiText.analytics.labelHealthy,
    moderate: uiText.analytics.labelModerate,
    risk: uiText.analytics.labelRisk,
  };
}

function MetricRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}

export function FinancialHealthCard({ health, loading = false }: FinancialHealthCardProps) {
  const activeCurrency = useDashboardCurrencyStore((state) => state.currency);
  const badgeClass =
    health?.label === "healthy"
      ? "bg-success/10 text-success"
      : health?.label === "moderate"
        ? "bg-warning/10 text-warning"
        : "bg-danger/10 text-danger";

  return (
    <Card className="shadow-sm">
      <CardHeader className="px-5">
        <CardTitle className="text-base font-semibold">{uiText.analytics.healthTitle}</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">{uiText.analytics.healthSubtitle}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Skeleton className="h-32 w-full rounded-xl" />
        ) : health ? (
          <>
            <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2">
              <div>
                <p className="text-xs text-muted-foreground">{uiText.analytics.score}</p>
                <p className="text-xl font-semibold text-foreground">{health.score}</p>
              </div>
              <span className={cn("rounded-full px-3 py-1 text-sm font-medium", badgeClass)}>
                {getLabelText()[health.label]}
              </span>
            </div>

            <div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(2, Math.min(100, health.score))}%`,
                    backgroundColor: BAR_COLOR[health.label],
                  }}
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                <span>{(uiText as any)?.analytics?.riskScaleLabel ?? "Risk"}</span>
                <span className="font-medium text-foreground">{health.score}/100</span>
              </div>
            </div>

            <dl className="space-y-2 text-sm">
              <MetricRow
                label={uiText.analytics.savingRate}
                value={`${health.savingRate.toFixed(1)}%`}
              />
              <MetricRow
                label={uiText.analytics.expenseRatio}
                value={`${health.expenseRatio.toFixed(1)}%`}
              />
              <MetricRow
                label={uiText.analytics.incomeVsExpense}
                value={
                  health.incomeVsExpense !== null ? `${health.incomeVsExpense.toFixed(2)}x` : "—"
                }
              />
              <MetricRow
                label={uiText.analytics.spendingConcentration}
                value={`${health.spendingConcentration.toFixed(1)}%`}
              />
              <MetricRow
                label={uiText.analytics.netCashFlow}
                value={
                  <span
                    className={cn(health.cashFlowPositive ? "text-emerald-500" : "text-red-500")}
                  >
                    {formatCurrencyCents(health.netCashFlow, activeCurrency)}
                  </span>
                }
              />
            </dl>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

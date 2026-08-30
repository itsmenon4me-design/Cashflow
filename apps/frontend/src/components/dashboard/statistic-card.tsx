import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Sparkline } from "@/components/common/sparkline";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { uiText } from "@/locales";

interface StatisticCardProps {
  label: string;
  value: string;
  change?: string;
  icon: LucideIcon;
  trend?: number[];
  comparison?: string;
  loading?: boolean;
  /** If true, render as a primary/high-emphasis KPI */
  emphasis?: boolean;
}

export function StatisticCard({
  label,
  value,
  change,
  icon: Icon,
  trend,
  comparison = uiText.common.vsLastMonth,
  loading = false,
  emphasis = false,
}: StatisticCardProps) {
  const hasChange = Boolean(change && change.trim());
  const isPositive = hasChange && change!.startsWith("+");
  const hasTrend = Boolean(trend && trend.length > 1);

  // Adaptive typography for KPI value based on formatted value length
  function getKpiValueClass(val: string) {
    const len = (val ?? "").trim().length;
    if (len <= 8) return "text-2xl sm:text-3xl font-bold tracking-tight";
    if (len <= 12) return "text-xl sm:text-2xl font-bold tracking-tight";
    if (len <= 16) return "text-lg sm:text-xl font-bold tracking-tight";
    return "text-base sm:text-lg font-bold tracking-tight";
  }

  return (
    <Card className="shadow-sm h-full min-h-[165px] flex flex-col justify-between">
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2 px-5 min-w-0">
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground leading-snug whitespace-nowrap" title={label}>
            {label}
          </p>
          {/* Fixed-height slot: loading skeleton and loaded value share identical geometry */}
          <div className="mt-2 flex h-9 items-center min-w-0">
            {loading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <div className="min-w-0 flex-1">
                <p className={cn("whitespace-nowrap tabular-nums text-foreground leading-tight overflow-visible", getKpiValueClass(value))}>
                  {value}
                </p>
              </div>
            )}
          </div>
        </div>
        {loading ? (
          <Skeleton className="size-9 rounded-xl shrink-0" />
        ) : (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-4" />
          </div>
        )}
      </CardHeader>
      <CardContent className="p-5 pt-0">
        {/* min-height matches the loaded delta-row + sparkline so data arrival never pushes layout */}
        <div className="min-h-[64px] flex flex-col justify-end">
          {loading ? (
            <>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-3 h-[26px] w-full" />
            </>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                {hasChange ? (
                  <>
                    <span
                      className={cn(
                        "flex items-center gap-1 font-medium",
                        isPositive ? "text-emerald-500" : "text-red-500"
                      )}
                    >
                      {isPositive ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                      {change}
                    </span>
                    <span className="text-muted-foreground text-xs">{comparison}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground text-xs font-normal">
                    {uiText.common.noComparisonData}
                  </span>
                )}
              </div>
              {hasTrend && (
                <div className="mt-2">
                  <Sparkline data={trend!} />
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

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
  changeTone?: "positive" | "negative" | "neutral";
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
  changeTone,
  icon: Icon,
  trend,
  comparison = uiText.common.vsLastMonth,
  loading = false,
}: StatisticCardProps) {
  const hasChange = Boolean(change && change.trim());
  const isPositive =
    hasChange &&
    (changeTone ? changeTone === "positive" : change!.startsWith("+"));
  const isNegative =
    hasChange &&
    (changeTone ? changeTone === "negative" : change!.startsWith("-"));
  const hasTrend = Boolean(trend && trend.length > 1);

  // Adaptive typography for KPI value based on formatted value length
  function getKpiValueClass(val: string) {
    const len = (val ?? "").trim().length;
    if (len <= 8) return "text-base sm:text-3xl font-bold tracking-tight";
    if (len <= 12) return "text-sm sm:text-2xl font-bold tracking-tight";
    if (len <= 16) return "text-xs sm:text-xl font-bold tracking-tight";
    return "text-[11px] sm:text-lg font-bold tracking-tight";
  }

  return (
    <Card className="shadow-sm h-full min-h-[116px] sm:min-h-[165px] flex flex-col justify-between gap-1 py-2 sm:gap-4 sm:py-4">
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2 px-3 sm:px-5 min-w-0">
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="truncate text-[10px] font-medium uppercase tracking-normal text-muted-foreground leading-snug whitespace-nowrap sm:text-xs sm:tracking-wider" title={label}>
            {label}
          </p>
          {/* Fixed-height slot: loading skeleton and loaded value share identical geometry */}
          <div className="mt-1.5 sm:mt-2 flex h-8 sm:h-9 items-center min-w-0">
            {loading ? (
              <Skeleton className="h-6 sm:h-7 w-20 sm:w-24" />
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
          <Skeleton className="hidden sm:block size-9 rounded-xl shrink-0" />
        ) : (
          <div className="hidden sm:flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-4" />
          </div>
        )}
      </CardHeader>
      <CardContent className="p-3 sm:p-5 pt-0">
        {/* min-height matches the loaded delta-row + sparkline so data arrival never pushes layout */}
        <div className="min-h-[28px] sm:min-h-[64px] flex flex-col justify-end">
          {loading ? (
            <>
              <Skeleton className="h-3.5 sm:h-4 w-20 sm:w-28" />
              <Skeleton className="mt-2 sm:mt-3 h-[20px] sm:h-[26px] w-full" />
            </>
          ) : (
            <>
              <div className="flex flex-col items-start gap-0.5 text-xs sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:text-sm">
                {hasChange ? (
                  <>
                    <span
                      className={cn(
                        "flex items-center gap-1 font-medium whitespace-nowrap",
                        isPositive
                          ? "text-emerald-700 dark:text-emerald-400"
                          : isNegative
                            ? "text-red-700 dark:text-red-400"
                            : "text-muted-foreground"
                      )}
                    >
                      {isPositive ? (
                        <ArrowUpRight className="size-3.5" />
                      ) : isNegative ? (
                        <ArrowDownRight className="size-3.5" />
                      ) : null}
                      {change}
                    </span>
                    <span className="text-muted-foreground text-[10px] sm:text-xs">{comparison}</span>
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

import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Sparkline } from "@/components/common/sparkline";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { uiText } from "@/locales";

interface StatisticCardProps {
  label: string;
  value: string;
  change: string;
  icon: LucideIcon;
  trend: number[];
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
  const isPositive = change.startsWith("+");

  // Adaptive typography for KPI value based on formatted value length
  function getKpiValueClass(val: string) {
    const len = (val ?? "").trim().length;
    if (len <= 8) return "text-3xl font-bold"; // ~30px
    if (len <= 12) return "text-2xl font-bold"; // ~24-28px
    if (len <= 16) return "text-xl font-bold"; // ~20-24px
    return "text-lg font-bold"; // ~18px
  }

  return (
    <Card className="shadow-sm min-h-[170px]">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2 px-5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground leading-snug">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-5 w-24" />
          ) : (
            <div className="min-w-0 overflow-hidden">
              <p className={cn("mt-2 tracking-tight text-foreground leading-tight", getKpiValueClass(value))}>
                {value}
              </p>
            </div>
          )}
        </div>
        {loading ? (
          <Skeleton className="size-9 rounded-xl" />
        ) : (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-4" />
          </div>
        )}
      </CardHeader>
      <CardContent className="p-5 pt-0">
        {loading ? (
          <>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full" />
          </>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm">
              <span
                className={cn(
                  "flex items-center gap-1 font-medium",
                  isPositive ? "text-emerald-500" : "text-red-500"
                )}
              >
                {isPositive ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                {change}
              </span>
              <span className="text-muted-foreground">{comparison}</span>
            </div>
            <div className="mt-3">
              <Sparkline data={trend} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

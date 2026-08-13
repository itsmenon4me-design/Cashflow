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
}

export function StatisticCard({
  label,
  value,
  change,
  icon: Icon,
  trend,
  comparison = uiText.common.vsLastMonth,
  loading = false,
}: StatisticCardProps) {
  const isPositive = change.startsWith("+");

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-32" />
          ) : (
            <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">{value}</p>
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
      <CardContent className="space-y-3 pt-0">
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
            <Sparkline data={trend} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

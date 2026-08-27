import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SummaryCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  change?: string;
  positive?: boolean;
  subtitle?: string;
  loading?: boolean;
}

export function SummaryCard({
  label,
  value,
  icon: Icon,
  change,
  positive,
  subtitle,
  loading = false,
}: SummaryCardProps) {
  const showChange = !loading && change !== undefined;

  function getKpiValueClass(val: string) {
    const len = (val ?? "").trim().length;
    if (len <= 8) return "text-2xl sm:text-3xl font-semibold tracking-tight";
    if (len <= 12) return "text-xl sm:text-2xl font-semibold tracking-tight";
    if (len <= 16) return "text-lg sm:text-xl font-semibold tracking-tight";
    return "text-base sm:text-lg font-semibold tracking-tight";
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-32" />
          ) : (
            <p className={cn("mt-2 text-foreground whitespace-nowrap tabular-nums overflow-visible", getKpiValueClass(value))}>
              {value}
            </p>
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
      {/* Reserved space: the loaded change row is ~20px — reserving it keeps
          the cards below stable when data arrives. */}
      <CardContent className="min-h-5 space-y-1 pt-0">
        {showChange && change ? (
          <div className="flex items-center justify-between text-sm">
            <span
              className={cn(
                "flex items-center gap-1 font-medium",
                positive ? "text-emerald-500" : "text-red-500"
              )}
            >
              {positive ? (
                <ArrowUpRight className="size-3.5" />
              ) : (
                <ArrowDownRight className="size-3.5" />
              )}
              {change}
            </span>
            {subtitle && <span className="text-muted-foreground">{subtitle}</span>}
          </div>
        ) : (
          !loading &&
          subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
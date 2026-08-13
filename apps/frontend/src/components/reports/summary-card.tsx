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
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
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
      <CardContent className="space-y-1 pt-0">
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
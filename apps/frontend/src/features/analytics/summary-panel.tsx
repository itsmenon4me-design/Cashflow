import {
  ArrowDownToLine,
  ArrowUpFromLine,
  PieChart,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { uiText } from "@/locales";
import type { AnalyticsDataset } from "@/types/dashboard";

interface SummaryTile {
  label: string;
  icon: LucideIcon;
  value: string;
  sub: string;
  valueClassName?: string;
}

interface SummaryPanelProps {
  dataset: AnalyticsDataset;
  unit: string;
  loading?: boolean;
}

export function SummaryPanel({ dataset, unit, loading = false }: SummaryPanelProps) {
  const tiles: SummaryTile[] = [
    {
      label: uiText.analytics.avgExpense,
      icon: ArrowUpFromLine,
      value: formatCurrency(dataset.avgExpense),
      sub: unit,
    },
    {
      label: uiText.analytics.avgIncome,
      icon: ArrowDownToLine,
      value: formatCurrency(dataset.avgIncome),
      sub: unit,
    },
    {
      label: uiText.analytics.cashFlow,
      icon: dataset.cashFlowPositive ? TrendingUp : TrendingDown,
      value: dataset.cashFlowPositive
        ? uiText.analytics.cashFlowPositive
        : uiText.analytics.cashFlowNegative,
      sub: formatCurrency(dataset.netCashFlow),
      valueClassName: dataset.cashFlowPositive ? "text-emerald-500" : "text-red-500",
    },
    {
      label: uiText.analytics.topCategory,
      icon: PieChart,
      value: dataset.topCategoryName,
      sub: formatCurrency(dataset.topCategoryValue),
    },
  ];

  return (
    <section
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      aria-label={uiText.analytics.title}
    >
      {tiles.map((tile) => {
        const Icon = tile.icon;

        return (
          <Card key={tile.label} className="shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {tile.label}
              </p>
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-4" />
              </div>
            </CardHeader>
            <CardContent className="space-y-1 pt-0">
              {loading ? (
                <Skeleton className="h-7 w-32" />
              ) : (
                <p className={cn("text-xl font-semibold tracking-tight text-foreground", tile.valueClassName)}>
                  {tile.value}
                </p>
              )}
              {loading ? (
                <Skeleton className="h-4 w-20" />
              ) : (
                <p className="text-xs text-muted-foreground">{tile.sub}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}

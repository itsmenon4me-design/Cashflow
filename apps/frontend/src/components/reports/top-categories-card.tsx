"use client";

import { Trophy } from "lucide-react";
import { ChartCard } from "@/components/dashboard/charts/ChartCard";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface TopCategoryItem {
  name: string;
  amount: number;
  percentage: number;
  transactionCount: number;
}

interface TopCategoriesCardProps {
  title: string;
  subtitle?: string;
  data: TopCategoryItem[];
  total: number;
  loading?: boolean;
}

export function TopCategoriesCard({
  title,
  subtitle,
  data,
  total,
  loading = false,
}: TopCategoriesCardProps) {
  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      loading={loading}
      empty={!data || data.length === 0}
      contentClassName="h-72 overflow-y-auto"
    >
      <div className="space-y-4">
        {data.map((item, index) => {
          const width = total > 0 ? Math.max(2, Math.min(100, (item.amount / total) * 100)) : 0;
          return (
            <div key={item.name} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-md text-xs font-semibold",
                      index === 0
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {index === 0 ? <Trophy className="size-3" /> : index + 1}
                  </span>
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="shrink-0 font-medium text-foreground">
                  {formatCurrency(item.amount)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${width}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">
                  {item.percentage.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
}
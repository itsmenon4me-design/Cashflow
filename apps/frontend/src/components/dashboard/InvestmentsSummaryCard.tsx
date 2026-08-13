"use client";

import { TrendingUp } from "lucide-react";
import { AllocationPieCard } from "@/components/investments/AllocationPieCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import { uiText } from "@/locales";
import type { InvestmentOverview } from "@/services/investment.service";

interface InvestmentsSummaryCardProps {
  data: InvestmentOverview | null;
  loading?: boolean;
}

export function InvestmentsSummaryCard({ data, loading = false }: InvestmentsSummaryCardProps) {
  const roi = data?.roi ?? 0;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="size-4 text-muted-foreground" />
          {uiText.investments.dashboardTitle}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{uiText.investments.dashboardSubtitle}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading || !data ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-28" />
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        ) : (
          <>
            <div>
              <p className="text-sm text-muted-foreground">{uiText.investments.currentValue}</p>
              <p className="text-2xl font-semibold tracking-tight">
                {formatCurrencyCents(data.totalValue)}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <p className="text-[11px] text-muted-foreground">{uiText.investments.totalProfit}</p>
                <p className="font-medium text-emerald-500">{formatCurrencyCents(data.totalProfit)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">{uiText.investments.totalLoss}</p>
                <p className="font-medium text-red-500">{formatCurrencyCents(-BigInt(data.totalLoss))}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">{uiText.investments.roi}</p>
                <p
                  className={cn(
                    "font-medium",
                    roi >= 0 ? "text-emerald-500" : "text-red-500"
                  )}
                >
                  {roi.toFixed(1)}%
                </p>
              </div>
            </div>
            <AllocationPieCard allocation={data.allocation} title={uiText.investments.allocation} className="shadow-none" />
          </>
        )}
      </CardContent>
    </Card>
  );
}

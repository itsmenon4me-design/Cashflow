"use client";

import dynamic from "next/dynamic";
import { TrendingUp } from "lucide-react";
// AllocationPieCard pulls in recharts; load it async so this card stays
// chart-free in the eager bundle (fallback reserves its height, no CLS).
const AllocationPieCard = dynamic(
  () => import("@/components/investments/AllocationPieCard").then((m) => m.AllocationPieCard),
  {
    ssr: false,
    loading: () => <div className="h-40 w-full animate-pulse rounded-xl bg-accent/50" aria-hidden="true" />,
  },
);
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import { uiText } from "@/locales";
import CenteredEmptyState from "@/components/states/CenteredEmptyState";
import type { InvestmentOverview } from "@/services/investment.service";

interface InvestmentsSummaryCardProps {
  data: InvestmentOverview | null;
  loading?: boolean;
}

export function InvestmentsSummaryCard({ data, loading = false }: InvestmentsSummaryCardProps) {
  const roi = data?.roi ?? 0;

  return (
    <Card className="shadow-sm">
      <CardHeader className="px-4 py-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">{uiText.investments.dashboardTitle}</CardTitle>
        <p className="text-sm text-muted-foreground">{uiText.investments.dashboardSubtitle}</p>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        {loading || !data ? (
          <div className="h-32 w-full">
            <CenteredEmptyState title={uiText.investments.emptyTitle || uiText.common.noDataAvailable} description={uiText.investments.emptySubtitle} />
          </div>
        ) : (
          <>
            <div>
              <p className="text-sm text-muted-foreground">{uiText.investments.currentValue}</p>
              <p className="text-xl font-semibold tracking-tight">
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

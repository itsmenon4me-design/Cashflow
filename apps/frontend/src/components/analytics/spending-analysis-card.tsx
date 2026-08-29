"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyCents } from "@/lib/format";
import { uiText } from "@/locales";
import type { AnalyticsSpending } from "@/services/analytics.service";

interface SpendingAnalysisCardProps {
  spending: AnalyticsSpending | null;
  loading?: boolean;
}

function Tile({
  label,
  value,
  loading,
}: {
  label: string;
  value: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-xl bg-muted p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-6 w-24" />
      ) : (
        <p className="mt-1 truncate text-lg font-semibold text-foreground">{value}</p>
      )}
    </div>
  );
}

export function SpendingAnalysisCard({ spending, loading = false }: SpendingAnalysisCardProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>{uiText.analytics.spendingTitle}</CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">{uiText.analytics.spendingSubtitle}</p>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-2">
        <Tile
          label={uiText.analytics.avgExpense}
          value={spending ? formatCurrencyCents(spending.avgExpense, "IDR") : "—"}
          loading={loading}
        />
        <Tile
          label={uiText.analytics.largestExpense}
          value={spending ? formatCurrencyCents(spending.largestExpense, "IDR") : "—"}
          loading={loading}
        />
        <Tile
          label={uiText.analytics.avgTransaction}
          value={spending ? formatCurrencyCents(spending.avgTransaction, "IDR") : "—"}
          loading={loading}
        />
        <Tile
          label={uiText.analytics.totalTransactions}
          value={spending ? spending.totalTransactions.toLocaleString("id-ID") : "—"}
          loading={loading}
        />
        <Tile
          label={uiText.analytics.incomeTransactions}
          value={spending ? spending.incomeTransactions.toLocaleString("id-ID") : "—"}
          loading={loading}
        />
        <Tile
          label={uiText.analytics.expenseTransactions}
          value={spending ? spending.expenseTransactions.toLocaleString("id-ID") : "—"}
          loading={loading}
        />
      </CardContent>
    </Card>
  );
}

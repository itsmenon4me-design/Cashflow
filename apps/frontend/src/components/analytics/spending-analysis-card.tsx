"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-muted p-3 min-w-0 overflow-hidden">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function SpendingAnalysisCard({ spending, loading = false }: SpendingAnalysisCardProps) {
  if (loading) return null;

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
        />
        <Tile
          label={uiText.analytics.largestExpense}
          value={spending ? formatCurrencyCents(spending.largestExpense, "IDR") : "—"}
        />
        <Tile
          label={uiText.analytics.avgTransaction}
          value={spending ? formatCurrencyCents(spending.avgTransaction, "IDR") : "—"}
        />
        <Tile
          label={uiText.analytics.totalTransactions}
          value={spending ? spending.totalTransactions.toLocaleString("id-ID") : "—"}
        />
        <Tile
          label={uiText.analytics.incomeTransactions}
          value={spending ? spending.incomeTransactions.toLocaleString("id-ID") : "—"}
        />
        <Tile
          label={uiText.analytics.expenseTransactions}
          value={spending ? spending.expenseTransactions.toLocaleString("id-ID") : "—"}
        />
      </CardContent>
    </Card>
  );
}

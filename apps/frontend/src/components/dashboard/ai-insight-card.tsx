"use client";

import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { uiText } from "@/locales";
import { useDashboardCurrencyStore } from "@/stores/dashboardCurrency.store";

interface AIInsightCardProps {
  items: string[];
}

export function AIInsightCard({ items }: AIInsightCardProps) {
  const activeCurrency = useDashboardCurrencyStore((state) => state.currency);

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-4 px-5">
        <div className="space-y-1">
          <CardTitle>{uiText.dashboard.aiInsight}</CardTitle>
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {uiText.dashboard.aiInsightContext.replace("{currency}", activeCurrency)}
          </p>
        </div>
        <Sparkles className="size-4 text-primary" />
      </CardHeader>
      <CardContent className="p-5 pt-0 space-y-3">
        {items && items.length > 0 ? (
          items.map((insight) => (
            <div
              key={insight}
              className="rounded-xl bg-muted px-3 py-3 text-sm leading-relaxed text-muted-foreground"
            >
              {insight}
            </div>
          ))
        ) : (
          <div className="rounded-xl bg-muted px-3 py-3 text-sm leading-relaxed text-muted-foreground">
            {uiText.dashboard.aiInsightEmpty}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

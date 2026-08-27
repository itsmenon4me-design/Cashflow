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

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-4 px-5 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">{uiText.dashboard.aiInsight}</CardTitle>
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {uiText.dashboard.aiInsightContext.replace("{currency}", activeCurrency)}
          </p>
        </div>
        <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="size-4" />
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-0 space-y-2.5">
        {items.map((insight, idx) => (
          <div
            key={idx}
            className="rounded-xl bg-muted/60 px-3.5 py-3 text-sm leading-relaxed text-foreground border border-border/50"
          >
            {insight}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

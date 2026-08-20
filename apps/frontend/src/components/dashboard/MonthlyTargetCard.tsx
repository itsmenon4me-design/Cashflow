"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyCents } from "@/lib/format";
import { getPercentage, getRemaining } from "@/lib/progress";
import { cn } from "@/lib/utils";
import { uiText } from "@/locales";
import { useDashboardCurrencyStore } from "@/stores/dashboardCurrency.store";
import type { MonthlyTargetItem } from "@/types/dashboard";

interface MonthlyTargetCardProps {
  items: MonthlyTargetItem[];
}

export function MonthlyTargetCard({ items }: MonthlyTargetCardProps) {
  const [expanded, setExpanded] = useState(true);
  const activeCurrency = useDashboardCurrencyStore((state) => state.currency);

  const totalTarget = items.reduce((sum, item) => sum + item.target, 0);
  const totalRealized = items.reduce((sum, item) => sum + item.realized, 0);
  const overallPercentage = getPercentage(totalRealized, totalTarget);

  return (
    <Card className="shadow-sm">
      <CardHeader className="px-4 py-3">
        <CardTitle className="text-base font-semibold">{uiText.dashboard.monthlyTarget}</CardTitle>
        <CardAction>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-controls="monthly-target-content"
            aria-label={expanded ? uiText.dashboard.collapseSection : uiText.dashboard.expandSection}
          >
            <ChevronDown
              className={cn(
                "size-4 transition-transform duration-200",
                !expanded && "-rotate-90"
              )}
            />
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent
        id="monthly-target-content"
        className={cn(expanded ? "p-3 pt-0 space-y-3" : "p-3 pt-0 space-y-2")}
      >
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{uiText.common.noDataAvailable}</p>
        ) : expanded ? (
          items.map((item) => {
            const percentage = getPercentage(item.realized, item.target);
            const remaining = getRemaining(item.realized, item.target);

            return (
              <div key={item.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground truncate">{item.name}</span>
                  <span className="font-semibold text-primary">{percentage}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-[11px] text-muted-foreground">{uiText.dashboard.targetMonth}</p>
                    <p className="font-medium text-foreground">{formatCurrencyCents(item.target, activeCurrency)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">{uiText.dashboard.realized}</p>
                    <p className="font-medium text-emerald-500">{formatCurrencyCents(item.realized, activeCurrency)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">{uiText.dashboard.remaining}</p>
                    <p className="font-medium text-foreground">{formatCurrencyCents(remaining, activeCurrency)}</p>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">{uiText.dashboard.monthlyTarget}</span>
              <span className="font-semibold text-primary">{overallPercentage}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${overallPercentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{uiText.dashboard.realized}</span>
              <span className="font-medium text-foreground">
                {formatCurrencyCents(totalRealized, activeCurrency)} / {formatCurrencyCents(totalTarget, activeCurrency)}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

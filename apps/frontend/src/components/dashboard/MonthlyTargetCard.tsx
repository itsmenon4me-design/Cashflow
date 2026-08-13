"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { getPercentage, getRemaining } from "@/lib/progress";
import { cn } from "@/lib/utils";
import { uiText } from "@/locales";
import type { MonthlyTargetItem } from "@/types/dashboard";

interface MonthlyTargetCardProps {
  items: MonthlyTargetItem[];
}

export function MonthlyTargetCard({ items }: MonthlyTargetCardProps) {
  const [expanded, setExpanded] = useState(true);

  const totalTarget = items.reduce((sum, item) => sum + item.target, 0);
  const totalRealized = items.reduce((sum, item) => sum + item.realized, 0);
  const overallPercentage = getPercentage(totalRealized, totalTarget);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>{uiText.dashboard.monthlyTarget}</CardTitle>
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
        className={cn(expanded ? "space-y-5" : "space-y-2")}
      >
        {expanded ? (
          items.map((item) => {
            const percentage = getPercentage(item.realized, item.target);
            const remaining = getRemaining(item.realized, item.target);

            return (
              <div key={item.id} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{item.name}</span>
                  <span className="font-semibold text-primary">{percentage}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="space-y-1 pt-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{uiText.dashboard.targetMonth}</span>
                    <span className="font-medium text-foreground">{formatCurrency(item.target)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{uiText.dashboard.realized}</span>
                    <span className="font-medium text-emerald-500">{formatCurrency(item.realized)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{uiText.dashboard.remaining}</span>
                    <span className="font-medium text-foreground">{formatCurrency(remaining)}</span>
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
                {formatCurrency(totalRealized)} / {formatCurrency(totalTarget)}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

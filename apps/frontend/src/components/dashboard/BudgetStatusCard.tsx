"use client";

import Link from "next/link";
import { ReceiptText, TriangleAlert } from "lucide-react";
import { BudgetProgress } from "@/components/budgets/BudgetProgress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyCents } from "@/lib/format";
import { uiText } from "@/locales";
import type { BudgetWidget } from "@/services/dashboard.service";

interface BudgetStatusCardProps {
  data: BudgetWidget | null;
  loading?: boolean;
}

export function BudgetStatusCard({ data, loading = false }: BudgetStatusCardProps) {
  const overall = data?.overall;
  const over = (overall?.spent ?? 0) > (overall?.budget ?? 0);

  if (loading || !overall) return null;

  return (
    <Link
      href="/budgets"
      className="block rounded-xl"
      aria-label={uiText.navigation.budgets}
    >
      <Card className="shadow-sm" interactive>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ReceiptText className="size-4 text-muted-foreground" />
            {uiText.budgets.dashboardTitle}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{uiText.budgets.dashboardSubtitle}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <BudgetProgress percentage={overall.percentageUsed} />
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <p className="text-[11px] text-muted-foreground">{uiText.budgets.totalBudget}</p>
              <p className="font-semibold text-foreground">
                {formatCurrencyCents(Math.round(overall.budget))}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">{uiText.budgets.totalSpent}</p>
              <p className="font-semibold text-foreground">
                {formatCurrencyCents(Math.round(overall.spent))}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">{uiText.budgets.remaining}</p>
              <p className="font-semibold text-foreground">
                {formatCurrencyCents(Math.round(Math.max(0, overall.budget - overall.spent)))}
              </p>
            </div>
          </div>
          {over && (
            <p className="flex items-center gap-1.5 text-sm font-medium text-red-500">
              <TriangleAlert className="size-4" />
              {uiText.budgets.overBudget}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
"use client";

import Link from "next/link";
import { Target, TriangleAlert } from "lucide-react";
import { SavingGoalProgress } from "@/components/saving-goals/SavingGoalProgress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyCents } from "@/lib/format";
import { uiText } from "@/locales";
import type { SavingGoalOverview } from "@/services/saving-goal.service";

interface SavingGoalsStatusCardProps {
  data: SavingGoalOverview | null;
  loading?: boolean;
}

export function SavingGoalsStatusCard({ data, loading = false }: SavingGoalsStatusCardProps) {
  const percentage = data?.percentageUsed ?? 0;

  return (
    <Link href="/goals" className="block rounded-xl" aria-label={uiText.navigation.goals}>
      <Card className="shadow-sm" interactive>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="size-4 text-muted-foreground" />
            {uiText.savingGoals.dashboardTitle}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{uiText.savingGoals.dashboardSubtitle}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading || !data ? (
            <div className="space-y-3">
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : (
            <>
              <SavingGoalProgress percentage={percentage} />
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div>
                  <p className="text-[11px] text-muted-foreground">{uiText.savingGoals.target}</p>
                  <p className="font-semibold text-foreground">{formatCurrencyCents(data.targetAmount)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">{uiText.savingGoals.collected}</p>
                  <p className="font-semibold text-foreground">{formatCurrencyCents(data.currentAmount)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">{uiText.savingGoals.remaining}</p>
                  <p className="font-semibold text-foreground">
                    {formatCurrencyCents(BigInt(data.targetAmount) - BigInt(data.currentAmount))}
                  </p>
                </div>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TriangleAlert className="size-3.5" />
                {data.active > 0
                  ? uiText.savingGoals.activeCount.replace("{count}", String(data.active))
                  : uiText.savingGoals.completedCount.replace(
                      "{count}",
                      String(data.completed),
                    )}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

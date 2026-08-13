"use client";

import { Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { uiText } from "@/locales";

interface InsightsCardProps {
  insights: string[];
  loading?: boolean;
}

export function InsightsCard({ insights, loading = false }: InsightsCardProps) {
  const isEmpty = !loading && insights.length === 0;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>{uiText.analytics.insightsTitle}</CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">{uiText.analytics.insightsSubtitle}</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ) : isEmpty ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {uiText.analytics.noInsights}
          </p>
        ) : (
          <ul className="space-y-2">
            {insights.map((insight, index) => (
              <li
                key={`${index}-${insight}`}
                className="flex items-start gap-3 rounded-xl bg-muted px-4 py-3 text-sm text-foreground"
              >
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
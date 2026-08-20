"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { formatCurrencyCents } from '@/lib/format';
import { categoryLabel } from '@/lib/categories';
import type { SpendingPredictionResponse } from '@/types/backend';
import { ConfidenceBadge } from './confidence-badge';

interface SpendingPredictionCardProps {
  data: SpendingPredictionResponse | null;
  currency: string;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  locale: string;
  text: {
    title: string;
    subtitle: string;
    periodLabel: string;
    totalLabel: string;
    otherLabel: string;
    breakdownTitle: string;
    basedOnMonths: string;
    noCategoryData: string;
    emptyTitle: string;
    emptyDescription: string;
    confidenceLabel: string;
    confidenceHigh: string;
    confidenceMedium: string;
    confidenceLow: string;
    errorTitle: string;
    errorDescription: string;
  };
}

function formatPeriodLabel(period: string, locale: string): string {
  const date = new Date(`${period}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return period;
  }

  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'id-ID', {
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function SpendingPredictionCard({
  data,
  currency,
  loading = false,
  error = false,
  onRetry,
  locale,
  text,
}: SpendingPredictionCardProps) {
  if (error) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{text.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState title={text.errorTitle} description={text.errorDescription} onRetry={onRetry} />
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{text.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{text.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState title={text.emptyTitle} description={text.emptyDescription} />
        </CardContent>
      </Card>
    );
  }

  if (data.insufficientData) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{text.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState title={text.emptyTitle} description={text.emptyDescription} />
        </CardContent>
      </Card>
    );
  }

  const hasOtherSpending = BigInt(data.otherCents.trim() || "0") > BigInt(0);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{text.title}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{text.subtitle}</p>
          </div>
          <div className="rounded-full border border-border bg-muted/40 px-3 py-1 text-sm text-muted-foreground">
            {text.periodLabel}: {formatPeriodLabel(data.period, locale)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">{text.totalLabel}</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrencyCents(data.predictedTotalCents, currency)}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <ConfidenceBadge
                confidence={data.confidence}
                labels={{ high: text.confidenceHigh, medium: text.confidenceMedium, low: text.confidenceLow }}
              />
              <span className="text-sm text-muted-foreground">{text.confidenceLabel}: {Math.round(data.confidence * 100)}%</span>
            </div>
          </div>
          {hasOtherSpending ? (
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">{text.otherLabel}</p>
              <p className="mt-2 text-xl font-semibold">{formatCurrencyCents(data.otherCents, currency)}</p>
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">{text.breakdownTitle}</h3>
          </div>

          {data.categories.length > 0 ? (
            <div className="space-y-2">
              {data.categories.map((item) => (
                <div
                  key={item.categoryId}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-foreground">{categoryLabel(item.categoryName)}</p>
                    <p className="text-sm text-muted-foreground">
                      {text.basedOnMonths.replace('{count}', String(item.basedOnMonths))}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <ConfidenceBadge
                      confidence={item.confidence}
                      labels={{ high: text.confidenceHigh, medium: text.confidenceMedium, low: text.confidenceLow }}
                    />
                    <span className="text-sm font-medium text-foreground">
                      {formatCurrencyCents(item.predictedAmountCents, currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title={text.noCategoryData} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

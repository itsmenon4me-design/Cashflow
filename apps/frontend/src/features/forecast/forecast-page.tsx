"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, TrendingUp, Wallet } from "lucide-react";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getUiText } from "@/locales";
import { forecastService } from "@/services/forecast.service";
import { useDataRefreshStore } from "@/stores/refresh.store";
import { useLanguageStore } from "@/stores/language.store";
import type { ForecastResponse, SpendingPredictionResponse } from "@/types/backend";
import { ConfidenceBadge } from "./components/confidence-badge";
// recharts-based chart loads via async chunk after first paint (low-CPU friendly)
import { LazyForecastChart as ForecastChart } from "@/components/charts/lazy-charts";
import { ForecastSummaryCard } from "./components/forecast-summary-card";
import { SpendingPredictionCard } from "./components/spending-prediction-card";
import { formatCurrencyCents } from "@/lib/format";

const FORECAST_HORIZON_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

function formatPeriodLabel(period: string, locale: string): string {
  const date = new Date(`${period}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return period;
  }

  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "id-ID", {
    month: "short",
    year: "numeric",
  }).format(date);
}

export function ForecastPage() {
  const [horizon, setHorizon] = useState(3);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [spendingPrediction, setSpendingPrediction] = useState<SpendingPredictionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [spendingLoading, setSpendingLoading] = useState(true);
  const [error, setError] = useState(false);
  const [spendingError, setSpendingError] = useState(false);
  const language = useLanguageStore((state) => state.language);
  const dataVersion = useDataRefreshStore((state) => state.version);

  const text = useMemo(() => getUiText(language), [language]);

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();

    const loadForecast = async () => {
      setLoading(true);
      setError(false);
      try {
        const response = await forecastService.getForecast({ horizon }, ac.signal);
        if (!cancelled) {
          setForecast(response);
          setHasLoadedOnce(true);
        }
      } catch (e) {
        if (!cancelled && !(e instanceof DOMException && e.name === "AbortError")) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadForecast();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [dataVersion, horizon]);

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();

    const loadSpendingPrediction = async () => {
      setSpendingLoading(true);
      setSpendingError(false);
      try {
        const response = await forecastService.getSpendingPrediction({ horizon: 1 }, ac.signal);
        if (!cancelled) {
          setSpendingPrediction(response);
        }
      } catch (e) {
        if (!cancelled && !(e instanceof DOMException && e.name === "AbortError")) {
          setSpendingError(true);
        }
      } finally {
        if (!cancelled) {
          setSpendingLoading(false);
        }
      }
    };

    void loadSpendingPrediction();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [dataVersion]);

  const loadForecastAgain = () => {
    setLoading(true);
    setError(false);
    void forecastService.getForecast({ horizon })
      .then((response) => {
        setForecast(response);
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{text.forecast.pageTitle}</h1>
        <p className="text-sm text-muted-foreground">{text.forecast.pageSubtitle}</p>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="space-y-1.5">
          <label htmlFor="forecast-horizon" className="text-sm font-medium text-foreground">
            {text.forecast.horizonLabel}
          </label>
          <Select value={String(horizon)} onValueChange={(value) => setHorizon(Number(value))}>
            <SelectTrigger id="forecast-horizon" className="w-full sm:w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORECAST_HORIZON_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option === 1 ? text.forecast.horizon1Month : text.forecast.horizonNMonths.replace("{count}", String(option))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading && !hasLoadedOnce ? (
        null
      ) : error && !forecast ? (
        <ErrorState
          title={text.forecast.errorTitle}
          description={text.forecast.errorDescription}
          onRetry={loadForecastAgain}
        />
      ) : !forecast ? (
        <EmptyState title={text.forecast.noData} />
      ) : forecast.insufficientData ? (
        <EmptyState
          title={text.forecast.insufficientDataTitle}
          description={text.forecast.insufficientDataDescription}
          className="min-h-[280px]"
        />
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
            <ForecastSummaryCard
              label={text.forecast.projectedIncome}
              value={formatCurrencyCents(
                forecast.months.at(-1)?.projectedIncomeCents ?? "0",
              )}
              icon={ArrowDownToLine}
              subtitle={text.forecast.summaryTitle}
            />
            <ForecastSummaryCard
              label={text.forecast.projectedExpense}
              value={formatCurrencyCents(
                forecast.months.at(-1)?.projectedExpenseCents ?? "0",
              )}
              icon={ArrowUpFromLine}
              subtitle={text.forecast.summaryTitle}
            />
            <ForecastSummaryCard
              label={text.forecast.projectedNetCashflow}
              value={formatCurrencyCents(
                forecast.months.at(-1)?.projectedNetCashflowCents ?? "0",
              )}
              icon={TrendingUp}
              subtitle={text.forecast.summaryTitle}
            />
            <ForecastSummaryCard
              label={text.forecast.projectedEndingBalance}
              value={formatCurrencyCents(
                forecast.months.at(-1)?.projectedEndingBalanceCents ?? "0",
              )}
              icon={Wallet}
              subtitle={text.forecast.currentBalance}
            />
          </section>

          <ForecastChart
            data={forecast}
            currency="IDR"
            loading={false}
            text={{
              chartTitle: text.forecast.chartTitle,
              chartSubtitle: text.forecast.chartSubtitle,
              chartIncomeLabel: text.forecast.chartIncomeLabel,
              chartExpenseLabel: text.forecast.chartExpenseLabel,
              chartNetLabel: text.forecast.chartNetLabel,
            }}
            locale={language}
          />

          <section className="grid gap-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>{text.forecast.breakdownTitle}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {forecast.months.map((month) => (
                  <div
                    key={month.period}
                    className="grid gap-3 rounded-xl border border-border bg-card px-4 py-3 md:grid-cols-[minmax(12rem,0.8fr)_minmax(0,2fr)] md:items-center"
                  >
                    <div>
                      <p className="font-medium text-foreground">{formatPeriodLabel(month.period, language)}</p>
                      <p className="text-sm text-muted-foreground">{text.forecast.breakdownPeriod}</p>
                    </div>
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{text.forecast.projectedIncome}</p>
                        <p className="text-sm font-semibold text-foreground">
                          {formatCurrencyCents(month.projectedIncomeCents, "IDR")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{text.forecast.projectedExpense}</p>
                        <p className="text-sm font-semibold text-foreground">
                          {formatCurrencyCents(month.projectedExpenseCents, "IDR")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{text.forecast.projectedNetCashflow}</p>
                        <p className="text-sm font-semibold text-foreground">
                          {formatCurrencyCents(month.projectedNetCashflowCents, "IDR")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{text.forecast.projectedEndingBalance}</p>
                        <p className="text-sm font-semibold text-foreground">
                          {formatCurrencyCents(month.projectedEndingBalanceCents, "IDR")}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>{text.forecast.confidenceTitle}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <ConfidenceBadge
                      confidence={forecast.confidence}
                      labels={{
                        high: text.forecast.confidenceHigh,
                        medium: text.forecast.confidenceMedium,
                        low: text.forecast.confidenceLow,
                      }}
                    />
                    <span className="text-sm text-muted-foreground">{Math.round(forecast.confidence * 100)}%</span>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <p className="text-sm font-semibold text-foreground">{text.forecast.basisTitle}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {text.forecast.basisDescription
                        .replace("{months}", String(forecast.basis.monthsUsed))
                        .replace("{start}", formatPeriodLabel(forecast.basis.historyStart, language))
                        .replace("{end}", formatPeriodLabel(forecast.basis.historyEnd, language))}
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{text.forecast.basisIncome}</p>
                        <p className="text-sm font-semibold text-foreground">
                          {formatCurrencyCents(forecast.basis.totalIncomeCents, "IDR")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{text.forecast.basisExpense}</p>
                        <p className="text-sm font-semibold text-foreground">
                          {formatCurrencyCents(forecast.basis.totalExpenseCents, "IDR")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{text.forecast.basisAverageIncome}</p>
                        <p className="text-sm font-semibold text-foreground">
                          {formatCurrencyCents(forecast.basis.averageMonthlyIncomeCents, "IDR")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{text.forecast.basisAverageExpense}</p>
                        <p className="text-sm font-semibold text-foreground">
                          {formatCurrencyCents(forecast.basis.averageMonthlyExpenseCents, "IDR")}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {forecast.outliers.length > 0 ? (
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle>{text.forecast.outlierTitle}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{text.forecast.outlierDescription}</p>
                    {forecast.outliers.map((outlier) => (
                      <div key={`${outlier.period}-${outlier.amountCents}`} className="rounded-xl border border-border bg-card px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-foreground">{formatPeriodLabel(outlier.period, language)}</span>
                          <span className="text-sm font-semibold text-foreground">
                            {formatCurrencyCents(outlier.amountCents, "IDR")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </section>
        </>
      )}

      {/* Last element on the page: render after load so its height change
          (placeholder -> data) can never push existing content. */}
      {!spendingLoading && (
        <SpendingPredictionCard
          data={spendingPrediction}
          currency="IDR"
          error={spendingError}
          onRetry={() => {
            setSpendingError(false);
            void forecastService.getSpendingPrediction({ horizon: 1 }).then(setSpendingPrediction).catch(() => setSpendingError(true));
          }}
          locale={language}
          text={{
            title: text.forecast.spendingTitle,
            subtitle: text.forecast.spendingSubtitle,
            periodLabel: text.forecast.spendingPeriodLabel,
            totalLabel: text.forecast.spendingTotalLabel,
            otherLabel: text.forecast.spendingOtherLabel,
          breakdownTitle: text.forecast.spendingBreakdownTitle,
          basedOnMonths: text.forecast.spendingBasedOnMonths,
          noCategoryData: text.forecast.spendingNoCategoryData,
          emptyTitle: text.forecast.spendingEmptyTitle,
          emptyDescription: text.forecast.spendingEmptyDescription,
          confidenceLabel: text.forecast.spendingConfidenceLabel,
          confidenceHigh: text.forecast.confidenceHigh,
          confidenceMedium: text.forecast.confidenceMedium,
          confidenceLow: text.forecast.confidenceLow,
          errorTitle: text.forecast.errorTitle,
          errorDescription: text.forecast.errorDescription,
        }}
        />
      )}
    </div>
  );
}

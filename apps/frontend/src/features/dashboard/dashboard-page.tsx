"use client";

import { useEffect, useState } from "react";
import { AIInsightCard } from "@/components/dashboard/ai-insight-card";
import { BalanceCard } from "@/components/dashboard/BalanceCard";
import { SavingGoalsStatusCard } from "@/components/dashboard/SavingGoalsStatusCard";
import { InvestmentsSummaryCard } from "@/components/dashboard/InvestmentsSummaryCard";
import { CashFlowCard } from "@/components/dashboard/CashFlowCard";
import { CashflowChartCard } from "@/components/dashboard/cashflow-chart-card";
import { CategoryDistributionCard } from "@/components/dashboard/category-distribution-card";
import { ExpenseCard } from "@/components/dashboard/ExpenseCard";
import { IncomeCard } from "@/components/dashboard/IncomeCard";
import { IncomeExpenseChartCard } from "@/components/dashboard/income-expense-chart-card";
import { RecentTransactionsCard } from "@/components/dashboard/recent-transactions-card";
import { RecentActivityCard } from "@/components/dashboard/recent-activity-card";
import { MonthlyTargetCard } from "@/components/dashboard/MonthlyTargetCard";
import { FinancialHealthCard } from "@/components/analytics/financial-health-card";
import { dashboardKpis } from "@/lib/mock-data";
import { formatCurrencyCents } from "@/lib/format";
import { normalizeDashboardCurrency, type DashboardCurrency } from "@/lib/dashboard-currency";
import { categoryLabel } from "@/lib/categories";
import {
  hydrateDashboardCurrency,
  useDashboardCurrencyStore,
} from "@/stores/dashboardCurrency.store";
import { uiText } from "@/locales";
import { analyticsService, type AnalyticsHealth } from "@/services/analytics.service";
import { dashboardService } from "@/services/dashboard.service";
import { savingGoalService } from "@/services/saving-goal.service";
import { investmentService } from "@/services/investment.service";
import { settingsService } from "@/services/settings.service";
import { budgetService } from "@/services/budget.service";
import { computeRange } from "@/features/reports/period";
import { useAuthStore } from "@/stores/auth.store";
import { useDataRefreshStore } from "@/stores/refresh.store";
import { ErrorState } from "@/components/states/ErrorState";
import type {
  CashFlowPoint,
  DashboardKpi,
  DistributionPoint,
  FlowPoint,
  MonthlyTargetItem,
  TransactionItem,
} from "@/types/dashboard";
import type { BudgetWidget } from "@/services/dashboard.service";
import type { SavingGoalOverview } from "@/services/saving-goal.service";
import type { InvestmentOverview } from "@/services/investment.service";

interface KpiState {
  balance: DashboardKpi;
  income: DashboardKpi;
  expense: DashboardKpi;
  cashflow: DashboardKpi;
}

const EMPTY_FLOW: FlowPoint[] = [];
const EMPTY_CASHFLOW: CashFlowPoint[] = [];
const EMPTY_CATEGORIES: DistributionPoint[] = [];
const EMPTY_TRANSACTIONS: TransactionItem[] = [];

function buildAiInsightsForCurrency(currency: DashboardCurrency): string[] {
  // Use localized strings from uiText so AI insights follow the app language.
  const localeInsights = (uiText.dashboard as any).aiInsightsByCurrency as
    | Record<string, string[]>
    | undefined;

  if (localeInsights && localeInsights[currency]) {
    return localeInsights[currency];
  }

  // Fallback to any available locale bucket or empty list (localized empty state
  // will be shown by the card when no items).
  if (localeInsights) {
    const firstKey = Object.keys(localeInsights)[0];
    return firstKey ? localeInsights[firstKey] ?? [] : [];
  }
  return [];
}

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const dataVersion = useDataRefreshStore((state) => state.version);
  const bump = useDataRefreshStore((state) => state.bump);
  const [kpis, setKpis] = useState<KpiState>({
    balance: dashboardKpis.balance,
    income: dashboardKpis.income,
    expense: dashboardKpis.expense,
    cashflow: dashboardKpis.cashflow,
  });
  const [flowSeries, setFlowSeries] = useState<{ cashFlow: CashFlowPoint[]; flow: FlowPoint[] }>({
    cashFlow: EMPTY_CASHFLOW,
    flow: EMPTY_FLOW,
  });
  const [categories, setCategories] = useState<DistributionPoint[]>(EMPTY_CATEGORIES);
  const [recentTxs, setRecentTxs] = useState<TransactionItem[]>(EMPTY_TRANSACTIONS);
  const [savingGoals, setSavingGoals] = useState<SavingGoalOverview | null>(null);
  const [investments, setInvestments] = useState<InvestmentOverview | null>(null);
  const [health, setHealth] = useState<AnalyticsHealth | null>(null);
  const [monthlyTargets, setMonthlyTargets] = useState<MonthlyTargetItem[]>([]);
  const [healthError, setHealthError] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  // Use shared dashboard currency store so header selector and dashboard page stay in sync
  const activeCurrency = useDashboardCurrencyStore((s) => s.currency);
  const setActiveCurrency = useDashboardCurrencyStore((s) => s.setCurrency);

  useEffect(() => {
    hydrateDashboardCurrency();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      if (typeof window === "undefined") {
        return;
      }

      const hasStoredCurrency =
        Boolean(window.localStorage.getItem("cashflow-dashboard-currency")) ||
        Boolean(window.sessionStorage.getItem("cashflow-dashboard-currency"));

      if (hasStoredCurrency) {
        return;
      }

      try {
        const settings = await settingsService.getSettings();
        if (!cancelled) {
          const nextCurrency = normalizeDashboardCurrency(settings.currency) ?? "USD";
          setActiveCurrency(nextCurrency);
        }
      } catch {
        if (!cancelled) {
          setActiveCurrency("USD");
        }
      }
    };

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [setActiveCurrency]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setHealth(null);
      setHealthError(false);
      // Keep current page content visible while new data loads to avoid a full-page blank flash.
      // We will set dataLoaded=true when the fetches complete.

      const now = new Date();

      await Promise.all([
        dashboardService
          .getSummary(activeCurrency)
          .then((summary) => {
            if (cancelled) {
              return;
            }
            setKpis((prev) => ({
              balance: {
                ...prev.balance,
                value: formatCurrencyCents(summary.total_assets_cents, activeCurrency),
              },
              income: {
                ...prev.income,
                value: formatCurrencyCents(summary.total_income_cents, activeCurrency),
              },
              expense: {
                ...prev.expense,
                value: formatCurrencyCents(summary.total_expense_cents, activeCurrency),
              },
              cashflow: {
                ...prev.cashflow,
                value: formatCurrencyCents(summary.net_cash_flow_cents, activeCurrency),
              },
            }));
          })
          .catch(() => {}),
        dashboardService
          .getFlowSeries(activeCurrency)
          .then((series) => {
            if (!cancelled) {
              setFlowSeries(series);
            }
          })
          .catch(() => {}),
        dashboardService
          .getCategoryDistribution(activeCurrency)
          .then((items) => {
            if (!cancelled) {
              setCategories(items);
            }
          })
          .catch(() => {}),
        dashboardService
          .getRecentTransactions(5, activeCurrency)
          .then((items) => {
            if (!cancelled) {
              setRecentTxs(items);
            }
          })
          .catch(() => {}),
        budgetService
          .analysis(now.getMonth() + 1, now.getFullYear(), activeCurrency)
          .then((analysis) => {
            if (!cancelled) {
              setMonthlyTargets(
                (analysis.categories ?? []).map((item) => ({
                  id: item.categoryId,
                  name: categoryLabel(item.categoryName || "Lainnya"),
                  target: item.budgetAmount,
                  realized: item.spentAmount,
                })),
              );
            }
          })
          .catch(() => {
            if (!cancelled) {
              setMonthlyTargets([]);
            }
          }),
        savingGoalService
          .overview(activeCurrency)
          .then((value) => {
            if (!cancelled) {
              setSavingGoals(value);
            }
          })
          .catch(() => {}),
        investmentService
          .overview(activeCurrency)
          .then((value) => {
            if (!cancelled) {
              setInvestments(value);
            }
          })
          .catch(() => {}),
        analyticsService
          .getFinancialHealth(computeRange("thisMonth"), activeCurrency)
          .then((value) => {
            if (cancelled) {
              return;
            }
            setHealth(value);
            setHealthError(false);
          })
          .catch(() => {
            if (!cancelled) {
              setHealthError(true);
            }
          }),
      ]).finally(() => {
        if (!cancelled) {
          try { console.log('[DashboardPage] load finished, setting dataLoaded=true'); } catch (e) {}
          setDataLoaded(true);
        }
      });
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [activeCurrency, dataVersion]);

  const firstName = user?.name?.split(" ")[0] ?? (uiText.common.quickAdd === "Quick Add" ? "User" : "Pengguna");
  const aiInsights = buildAiInsightsForCurrency(activeCurrency);

  // Time-aware localized greeting. Compute on mount to remain hydration-safe
  const [greeting, setGreeting] = useState<string>(uiText.dashboard.welcomeBack.replace("{name}", firstName));

  useEffect(() => {
    const compute = () => {
      const hour = new Date().getHours();
      let key = "greetingMorning";
      if (hour >= 4 && hour < 11) key = "greetingMorning";
      else if (hour >= 11 && hour < 15) key = "greetingAfternoon";
      else if (hour >= 15 && hour < 18) key = "greetingEvening";
      else key = "greetingNight";
      const template = (uiText.dashboard as any)[key] ?? uiText.dashboard.welcomeBack;
      setGreeting(template.replace("{name}", firstName));
    };

    // Compute immediately on mount
    compute();
    // Optionally update periodically if the user keeps the app open across hour boundaries
    const timer = setInterval(compute, 60 * 1000);
    return () => clearInterval(timer);
  }, [firstName]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">{greeting}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{uiText.dashboard.summarySubtitle}</p>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <BalanceCard kpi={kpis.balance} loading={!dataLoaded} />
        <IncomeCard kpi={kpis.income} loading={!dataLoaded} />
        <ExpenseCard kpi={kpis.expense} loading={!dataLoaded} />
        <CashFlowCard kpi={kpis.cashflow} loading={!dataLoaded} />
      </section>

      {/* Reduced clutter: place cashflow chart and category distribution together; CashFlowCard moved below to reduce KPI competition */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <CashflowChartCard data={flowSeries.cashFlow} currency={activeCurrency} />
        <CategoryDistributionCard data={categories} currency={activeCurrency} />
      </section>

      {/* Target & secondary cards: place Monthly Target into main flow and keep saving goals & investments compact */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <MonthlyTargetCard items={monthlyTargets} />
        <div className="grid grid-cols-1 gap-4">
          <SavingGoalsStatusCard data={savingGoals} loading={!dataLoaded} />
          <InvestmentsSummaryCard data={investments} loading={!dataLoaded} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <IncomeExpenseChartCard data={flowSeries.flow} currency={activeCurrency} />
        {healthError ? (
          <ErrorState
            title={uiText.states.errorTitle}
            description={uiText.states.errorDescription}
            onRetry={bump}
          />
        ) : (
          <FinancialHealthCard health={health} loading={!dataLoaded} />
        )}
      </section>

      <RecentTransactionsCard items={recentTxs} />

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <RecentActivityCard />
        <AIInsightCard items={aiInsights} />
      </section>
    </div>
  );
}

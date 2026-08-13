"use client";

import { useEffect, useState } from "react";
import { AIInsightCard } from "@/components/dashboard/ai-insight-card";
import { BalanceCard } from "@/components/dashboard/BalanceCard";
import { BudgetStatusCard } from "@/components/dashboard/BudgetStatusCard";
import { BudgetSuggestCard } from "@/components/dashboard/BudgetSuggestCard";
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
import { FinancialHealthCard } from "@/components/analytics/financial-health-card";
import { aiInsights, dashboardKpis } from "@/lib/mock-data";
import { formatCurrencyCents } from "@/lib/format";
import { uiText } from "@/locales";
import { analyticsService, type AnalyticsHealth } from "@/services/analytics.service";
import { dashboardService } from "@/services/dashboard.service";
import { savingGoalService } from "@/services/saving-goal.service";
import { investmentService } from "@/services/investment.service";
import { computeRange } from "@/features/reports/period";
import { useAuthStore } from "@/stores/auth.store";
import { useDataRefreshStore } from "@/stores/refresh.store";
import { ErrorState } from "@/components/states/ErrorState";
import type {
  CashFlowPoint,
  DashboardKpi,
  DistributionPoint,
  FlowPoint,
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
  const [budget, setBudget] = useState<BudgetWidget | null>(null);
  const [savingGoals, setSavingGoals] = useState<SavingGoalOverview | null>(null);
  const [investments, setInvestments] = useState<InvestmentOverview | null>(null);
  const [health, setHealth] = useState<AnalyticsHealth | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      await Promise.all([
        dashboardService
          .getSummary()
          .then((summary) => {
            if (cancelled) {
              return;
            }
            setKpis((prev) => ({
              balance: {
                ...prev.balance,
                value: formatCurrencyCents(summary.total_assets_cents),
              },
              income: {
                ...prev.income,
                value: formatCurrencyCents(summary.total_income_cents),
              },
              expense: {
                ...prev.expense,
                value: formatCurrencyCents(summary.total_expense_cents),
              },
              cashflow: {
                ...prev.cashflow,
                value: formatCurrencyCents(summary.net_cash_flow_cents),
              },
            }));
          })
          .catch(() => {}),
        dashboardService
          .getFlowSeries()
          .then((series) => {
            if (!cancelled) {
              setFlowSeries(series);
            }
          })
          .catch(() => {}),
        dashboardService
          .getCategoryDistribution()
          .then((items) => {
            if (!cancelled) {
              setCategories(items);
            }
          })
          .catch(() => {}),
        dashboardService
          .getRecentTransactions(5)
          .then((items) => {
            if (!cancelled) {
              setRecentTxs(items);
            }
          })
          .catch(() => {}),
        dashboardService
          .getBudgetStatus()
          .then((value) => {
            if (!cancelled) {
              setBudget(value);
            }
          })
          .catch(() => {}),
        savingGoalService
          .overview()
          .then((value) => {
            if (!cancelled) {
              setSavingGoals(value);
            }
          })
          .catch(() => {}),
        investmentService
          .overview()
          .then((value) => {
            if (!cancelled) {
              setInvestments(value);
            }
          })
          .catch(() => {}),
        analyticsService
          .getFinancialHealth(computeRange("thisMonth"))
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
          setDataLoaded(true);
        }
      });
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [dataVersion]);

  const firstName = user?.name?.split(" ")[0] ?? "Pengguna";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {uiText.dashboard.welcomeBack.replace("{name}", firstName)}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{uiText.dashboard.summarySubtitle}</p>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <BalanceCard kpi={kpis.balance} loading={!dataLoaded} />
        <IncomeCard kpi={kpis.income} loading={!dataLoaded} />
        <ExpenseCard kpi={kpis.expense} loading={!dataLoaded} />
        <CashFlowCard kpi={kpis.cashflow} loading={!dataLoaded} />
      </section>

      {/* TODO: hanya AI insights yang belum punya backend (mock sementara). */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <CashflowChartCard data={flowSeries.cashFlow} />
        <CategoryDistributionCard data={categories} />
      </section>

      {!dataLoaded ? (
        <BudgetStatusCard data={budget} loading />
      ) : !budget || !Array.isArray(budget.categories) ? (
        <ErrorState
          title={uiText.states.errorTitle}
          description={uiText.states.errorDescription}
          onRetry={bump}
        />
      ) : budget.categories.length > 0 ? (
        <BudgetStatusCard data={budget} />
      ) : (
        <BudgetSuggestCard />
      )}

      <SavingGoalsStatusCard data={savingGoals} loading={!dataLoaded} />

      <InvestmentsSummaryCard data={investments} loading={!dataLoaded} />

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <IncomeExpenseChartCard data={flowSeries.flow} />
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

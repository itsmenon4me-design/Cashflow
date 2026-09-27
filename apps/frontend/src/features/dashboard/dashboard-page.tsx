"use client";

import { useEffect, useState, memo } from "react";
import { AIInsightCard } from "@/components/dashboard/ai-insight-card";
import { BalanceCard } from "@/components/dashboard/BalanceCard";
import { CashFlowCard } from "@/components/dashboard/CashFlowCard";
// recharts-based cards load via async chunks after first paint (low-CPU friendly)
import { LazyCashflowChartCard as CashflowChartCard } from "@/components/charts/lazy-charts";
import { ExpenseCard } from "@/components/dashboard/ExpenseCard";
import { IncomeCard } from "@/components/dashboard/IncomeCard";
import { RecentTransactionsCard } from "@/components/dashboard/recent-transactions-card";
import { formatCurrencyCents } from "@/lib/format";
import { uiText } from "@/locales";
import { analyticsService } from "@/services/analytics.service";
import { dashboardService } from "@/services/dashboard.service";
import { computeRange } from "@/features/reports/period";
import { useAuthStore } from "@/stores/auth.store";
import { useDataRefreshStore } from "@/stores/refresh.store";
import type {
  CashFlowPoint,
  DashboardKpi,
  TransactionItem,
} from "@/types/dashboard";

interface KpiState {
  balance: DashboardKpi;
  income: DashboardKpi;
  expense: DashboardKpi;
  cashflow: DashboardKpi;
}

const EMPTY_CASHFLOW: CashFlowPoint[] = [];
const EMPTY_TRANSACTIONS: TransactionItem[] = [];

// Memoized leaves: skip reconciliation unless props change
const MemoRecentTransactionsCard = memo(RecentTransactionsCard);
const MemoAIInsightCard = memo(AIInsightCard);

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const dataVersion = useDataRefreshStore((state) => state.version);
  const [kpis, setKpis] = useState<KpiState>({
    balance: { value: formatCurrencyCents("0") },
    income: { value: formatCurrencyCents("0") },
    expense: { value: formatCurrencyCents("0") },
    cashflow: { value: formatCurrencyCents("0") },
  });
  const [hasLoadedKpis, setHasLoadedKpis] = useState(false);
  const [cashFlowSeries, setCashFlowSeries] =
    useState<CashFlowPoint[]>(EMPTY_CASHFLOW);
  const [recentTxs, setRecentTxs] =
    useState<TransactionItem[]>(EMPTY_TRANSACTIONS);
  const [insights, setInsights] = useState<string[]>([]);
  const [flowLoadFailed, setFlowLoadFailed] = useState(false);
  const [transactionsLoadFailed, setTransactionsLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      void dashboardService
        .getSummary()
        .then((summary) => {
          if (cancelled || !summary) return;

          const netCashFlow = BigInt(summary.net_cash_flow_cents);
          const cashflow: DashboardKpi = {
            value: formatCurrencyCents(summary.net_cash_flow_cents),
          };
          if (summary.previous_net_cash_flow_cents !== undefined) {
            const previousNetCashFlow = BigInt(
              summary.previous_net_cash_flow_cents,
            );
            const cashFlowChange = netCashFlow - previousNetCashFlow;
            const zero = BigInt(0);
            cashflow.change = `${cashFlowChange > zero ? "+" : cashFlowChange < zero ? "-" : ""}${formatCurrencyCents(cashFlowChange < zero ? -cashFlowChange : cashFlowChange)}`;
            cashflow.changeTone =
              cashFlowChange > zero
                ? "positive"
                : cashFlowChange < zero
                  ? "negative"
                  : "neutral";
          }
          setKpis({
            balance: {
              value: formatCurrencyCents(summary.total_assets_cents),
            },
            income: {
              value: formatCurrencyCents(summary.total_income_cents),
            },
            expense: {
              value: formatCurrencyCents(summary.total_expense_cents),
            },
            cashflow,
          });
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setHasLoadedKpis(true);
        });

      void dashboardService
        .getFlowSeries()
        .then((flow) => {
          if (cancelled) return;
          setCashFlowSeries(flow.cashFlow);
          setFlowLoadFailed(false);
        })
        .catch(() => {
          if (!cancelled) setFlowLoadFailed(true);
        });

      void dashboardService
        .getRecentTransactions(5)
        .then((transactions) => {
          if (cancelled) return;
          setRecentTxs(transactions);
          setTransactionsLoadFailed(false);
        })
        .catch(() => {
          if (!cancelled) setTransactionsLoadFailed(true);
        });

      void analyticsService
        .getInsights(computeRange("thisMonth"))
        .then((insightItems) => {
          if (cancelled) return;
          setInsights(
            insightItems.filter(
              (item) =>
                !item.toLowerCase().includes("selaras dengan preferensi") &&
                !item.toLowerCase().includes("preferensi tampilan"),
            ),
          );
        })
        .catch(() => undefined);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [dataVersion]);

  const displayName = user?.name?.trim() || uiText.common.user;

  const computedGreeting = (() => {
    const hour = new Date().getHours();
    let key:
      | "greetingMorning"
      | "greetingAfternoon"
      | "greetingEvening"
      | "greetingNight";
    if (hour >= 4 && hour < 11) key = "greetingMorning";
    else if (hour >= 11 && hour < 15) key = "greetingAfternoon";
    else if (hour >= 15 && hour < 18) key = "greetingEvening";
    else key = "greetingNight";
    const template = uiText.dashboard[key] ?? uiText.dashboard.welcomeBack;
    return template.replace("{name}", displayName);
  })();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {computedGreeting}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {uiText.dashboard.summarySubtitle}
        </p>
      </div>

      {/* Section 1: 4 KPI Cards */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <div className="order-1">
          <BalanceCard kpi={kpis.balance} loading={!hasLoadedKpis} />
        </div>
        <div className="order-2">
          <IncomeCard kpi={kpis.income} loading={!hasLoadedKpis} />
        </div>
        <div className="order-4 xl:order-3">
          <ExpenseCard kpi={kpis.expense} loading={!hasLoadedKpis} />
        </div>
        <div className="order-3 xl:order-4">
          <CashFlowCard kpi={kpis.cashflow} loading={!hasLoadedKpis} />
        </div>
      </section>

      {/* Section 2: Chart Arus Kas Bulanan */}
      <section>
        {flowLoadFailed && (
          <p className="mb-3 text-sm text-destructive" role="alert">
            {uiText.dashboard.flowLoadError}
          </p>
        )}
        <CashflowChartCard data={cashFlowSeries} />
      </section>

      {/* Section 3: Transaksi Terbaru */}
      <section>
        {transactionsLoadFailed && (
          <p className="mb-3 text-sm text-destructive" role="alert">
            {uiText.dashboard.recentTransactionsLoadError}
          </p>
        )}
        <MemoRecentTransactionsCard items={recentTxs} />
      </section>

      {/* Section 4: Wawasan AI (Conditional - only if actionable insights exist) */}
      {insights.length > 0 && (
        <section>
          <MemoAIInsightCard items={insights} />
        </section>
      )}
    </div>
  );
}

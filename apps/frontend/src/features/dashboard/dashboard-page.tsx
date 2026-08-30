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
  const [cashFlowSeries, setCashFlowSeries] = useState<CashFlowPoint[]>(EMPTY_CASHFLOW);
  const [recentTxs, setRecentTxs] = useState<TransactionItem[]>(EMPTY_TRANSACTIONS);
  const [insights, setInsights] = useState<string[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      await Promise.all([
        dashboardService
          .getSummary()
          .then((summary) => {
            if (cancelled) return;
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
              setCashFlowSeries(series.cashFlow ?? EMPTY_CASHFLOW);
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
        analyticsService
          .getInsights(computeRange("thisMonth"))
          .then((items) => {
            if (!cancelled) {
              // Filter out non-actionable generic fallback text
              const filtered = (items ?? []).filter(
                (item) => !item.toLowerCase().includes("selaras dengan preferensi") && !item.toLowerCase().includes("preferensi tampilan")
              );
              setInsights(filtered);
            }
          })
          .catch(() => {
            if (!cancelled) setInsights([]);
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

  const firstName = user?.name?.split(" ")[0] ?? uiText.common.user;

  const computedGreeting = (() => {
    const hour = new Date().getHours();
    let key: "greetingMorning" | "greetingAfternoon" | "greetingEvening" | "greetingNight";
    if (hour >= 4 && hour < 11) key = "greetingMorning";
    else if (hour >= 11 && hour < 15) key = "greetingAfternoon";
    else if (hour >= 15 && hour < 18) key = "greetingEvening";
    else key = "greetingNight";
    const template = (uiText.dashboard as any)[key] ?? uiText.dashboard.welcomeBack;
    return template.replace("{name}", firstName);
  })();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{computedGreeting}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{uiText.dashboard.summarySubtitle}</p>
      </div>

      {/* Section 1: 4 KPI Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <BalanceCard kpi={kpis.balance} loading={!dataLoaded} />
        <IncomeCard kpi={kpis.income} loading={!dataLoaded} />
        <ExpenseCard kpi={kpis.expense} loading={!dataLoaded} />
        <CashFlowCard kpi={kpis.cashflow} loading={!dataLoaded} />
      </section>

      {/* Section 2: Chart Arus Kas Bulanan */}
      <section>
        <CashflowChartCard data={cashFlowSeries} />
      </section>

      {/* Section 3: Transaksi Terbaru */}
      <section>
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

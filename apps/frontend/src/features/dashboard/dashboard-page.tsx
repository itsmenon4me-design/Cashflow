import { AIInsightCard } from "@/components/dashboard/ai-insight-card";
import { BalanceCard } from "@/components/dashboard/BalanceCard";
import { CashFlowCard } from "@/components/dashboard/CashFlowCard";
import { CashflowChartCard } from "@/components/dashboard/cashflow-chart-card";
import { CategoryDistributionCard } from "@/components/dashboard/category-distribution-card";
import { ExpenseCard } from "@/components/dashboard/ExpenseCard";
import { IncomeCard } from "@/components/dashboard/IncomeCard";
import { IncomeExpenseChartCard } from "@/components/dashboard/income-expense-chart-card";
import { RecentTransactionsCard } from "@/components/dashboard/recent-transactions-card";
import {
  aiInsights,
  dashboardKpis,
  expenseCategories,
  incomeExpenseData,
  mockUser,
  monthlyCashFlow,
  recentTransactions,
} from "@/lib/mock-data";
import { uiText } from "@/locales";

export function DashboardPage() {
  const firstName = mockUser.name.split(" ")[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {uiText.dashboard.welcomeBack.replace("{name}", firstName)}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{uiText.dashboard.summarySubtitle}</p>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <BalanceCard kpi={dashboardKpis.balance} />
        <IncomeCard kpi={dashboardKpis.income} />
        <ExpenseCard kpi={dashboardKpis.expense} />
        <CashFlowCard kpi={dashboardKpis.cashflow} />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <CashflowChartCard data={monthlyCashFlow} />
        <CategoryDistributionCard data={expenseCategories} />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <IncomeExpenseChartCard data={incomeExpenseData} />
        <AIInsightCard items={aiInsights} />
      </section>

      <RecentTransactionsCard items={recentTransactions} />
    </div>
  );
}

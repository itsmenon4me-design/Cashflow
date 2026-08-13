import { apiClient } from "@/lib/axios";
import { accountService } from "@/services/account.service";
import { categoryService } from "@/services/category.service";
import { transactionService, toTransactionItem } from "@/services/transaction.service";
import type { DashboardSummaryResponse } from "@/types/backend";
import type {
  CashFlowPoint,
  DistributionPoint,
  FlowPoint,
  TransactionItem,
} from "@/types/dashboard";

export interface BudgetWidget {
  month: number;
  year: number;
  overall: {
    budget: number;
    spent: number;
    remaining: number;
    percentageUsed: number;
  };
  categories: Array<{
    categoryId: string;
    categoryName: string | null;
    budgetAmount: number;
    spentAmount: number;
    remainingAmount: number;
    percentageUsed: number;
    status: string;
  }>;
}

export interface DashboardWidgetsResponse {
  summary: DashboardSummaryResponse;
  cashFlow: {
    income: number;
    expense: number;
    netCashFlow: number;
    comparison: Record<string, unknown> | null;
  } | null;
  monthlyReport: {
    month: number;
    year: number;
    summary: { income: number; expense: number; netCashFlow: number; transactions: number };
  } | null;
  categoryBreakdown: Array<{
    categoryId: string;
    categoryName: string;
    totalAmount: number;
    percentage: number;
    transactionCount: number;
  }>;
  trend: {
    type: string;
    data: Array<{ period: string; income: number; expense: number; netCashFlow: number }>;
  } | null;
  budget: BudgetWidget | null;
}

export interface FlowSeries {
  cashFlow: CashFlowPoint[];
  flow: FlowPoint[];
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function monthLabel(period: string): string {
  const month = period.split("-")[1];
  const idx = Number(month) - 1;
  return Number.isInteger(idx) && idx >= 0 && idx < 12 ? MONTH_LABELS[idx] : period;
}

export const dashboardService = {
  getSummary: (): Promise<DashboardSummaryResponse> =>
    apiClient.get<DashboardSummaryResponse>("/dashboard/summary"),

  getWidgets: (): Promise<DashboardWidgetsResponse> =>
    apiClient.get<DashboardWidgetsResponse>("/dashboard/widgets"),

  getFlowSeries: async (): Promise<FlowSeries> => {
    const widgets = await dashboardService.getWidgets();
    const points = widgets.trend?.data ?? [];
    return {
      cashFlow: points.map((p) => ({ month: monthLabel(p.period), balance: p.netCashFlow })),
      flow: points.map((p) => ({ month: monthLabel(p.period), income: p.income, expense: p.expense })),
    };
  },

  getCategoryDistribution: async (): Promise<DistributionPoint[]> => {
    const widgets = await dashboardService.getWidgets();
    return (widgets.categoryBreakdown ?? []).map((c) => ({
      name: c.categoryName || "Lainnya",
      value: Math.round((c.percentage ?? 0) * 100) / 100,
    }));
  },

  getRecentTransactions: async (limit = 5): Promise<TransactionItem[]> => {
    const [page, accounts, categories] = await Promise.all([
      transactionService.list({ page: 1, limit }),
      accountService.list().catch(() => []),
      categoryService.list().catch(() => []),
    ]);
    const accountNames = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
    const categoryNames = Object.fromEntries(categories.map((c) => [c.id, c.name]));
    return (page.data ?? []).map((dto) => toTransactionItem(dto, accountNames, categoryNames));
  },

  getBudgetStatus: async (): Promise<BudgetWidget | null> => {
    const widgets = await dashboardService.getWidgets();
    return widgets.budget ?? null;
  },
};

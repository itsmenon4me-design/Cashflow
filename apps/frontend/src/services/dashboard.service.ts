import { apiClient } from "@/lib/axios";
import { normalizeDashboardCurrency } from "@/lib/dashboard-currency";
import { accountService } from "@/services/account.service";
import { categoryService } from "@/services/category.service";
import { transactionService, toTransactionItem } from "@/services/transaction.service";
import { useDashboardCurrencyStore } from "@/stores/dashboardCurrency.store";
import type { DashboardSummaryResponse } from "@/types/backend";
import type {
  CashFlowPoint,
  DistributionPoint,
  FlowPoint,
  TransactionItem,
} from "@/types/dashboard";

export type CentsValue = string | number;

export interface BudgetWidgetWire {
  month: number;
  year: number;
  overall: {
    budget: CentsValue;
    spent: CentsValue;
    remaining: CentsValue;
    percentageUsed: number;
  };
  categories: Array<{
    categoryId: string;
    categoryName: string | null;
    budgetAmount: CentsValue;
    spentAmount: CentsValue;
    remainingAmount: CentsValue;
    percentageUsed: number;
    status: string;
  }>;
}

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
  budget: BudgetWidgetWire | null;
}

function toNumber(value: CentsValue | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toBudgetWidget(raw: BudgetWidgetWire | null | undefined): BudgetWidget | null {
  if (!raw) return null;
  return {
    month: raw.month,
    year: raw.year,
    overall: {
      budget: toNumber(raw.overall?.budget),
      spent: toNumber(raw.overall?.spent),
      remaining: toNumber(raw.overall?.remaining),
      percentageUsed: raw.overall?.percentageUsed ?? 0,
    },
    categories: (raw.categories ?? []).map((c) => ({
      categoryId: c.categoryId,
      categoryName: c.categoryName ?? null,
      budgetAmount: toNumber(c.budgetAmount),
      spentAmount: toNumber(c.spentAmount),
      remainingAmount: toNumber(c.remainingAmount),
      percentageUsed: c.percentageUsed ?? 0,
      status: c.status ?? "active",
    })),
  };
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
  getSummary: (currency?: string): Promise<DashboardSummaryResponse> => {
    const activeCurrency = currency ?? useDashboardCurrencyStore.getState().currency;
    const normalized = normalizeDashboardCurrency(activeCurrency) ?? useDashboardCurrencyStore.getState().currency;
    return apiClient.get<DashboardSummaryResponse>("/dashboard/summary", {
      params: { currency: normalized },
    });
  },

  getWidgets: (currency?: string): Promise<DashboardWidgetsResponse> => {
    const activeCurrency = currency ?? useDashboardCurrencyStore.getState().currency;
    const normalized = normalizeDashboardCurrency(activeCurrency) ?? useDashboardCurrencyStore.getState().currency;
    return apiClient.get<DashboardWidgetsResponse>("/dashboard/widgets", {
      params: { currency: normalized },
    });
  },


  getFlowSeries: async (currency?: string): Promise<FlowSeries> => {
    const widgets = await dashboardService.getWidgets(currency);
    const points = widgets.trend?.data ?? [];
    return {
      cashFlow: points.map((p) => ({ month: monthLabel(p.period), balance: p.netCashFlow })),
      flow: points.map((p) => ({ month: monthLabel(p.period), income: p.income, expense: p.expense })),
    };
  },

  getCategoryDistribution: async (currency?: string): Promise<DistributionPoint[]> => {
    const widgets = await dashboardService.getWidgets(currency);
    return (widgets.categoryBreakdown ?? []).map((c) => ({
      name: c.categoryName || "Lainnya",
      value: Math.round((c.percentage ?? 0) * 100) / 100,
      amount: typeof c.totalAmount === 'number' ? c.totalAmount : Number(c.totalAmount) || 0,
    }));
  },


  getRecentTransactions: async (limit = 5, currency?: string): Promise<TransactionItem[]> => {
    // Ask transactions with a currency hint. Backend may filter, else we filter accounts client-side.
    const [page, accounts, categories] = await Promise.all([
      transactionService.list({ page: 1, limit, currency }),
      accountService.list(currency).catch(() => []),
      categoryService.list().catch(() => []),
    ]);
    const accountNames = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
    const categoryNames = Object.fromEntries(categories.map((c) => [c.id, c.name]));
    const accountCurrencies: Record<string, string> = Object.fromEntries(
      accounts.map((a) => [a.id, a.currency]),
    );
    return (page.data ?? []).map((dto) =>
      toTransactionItem(dto, accountNames, categoryNames, accountCurrencies),
    );
  },

  getBudgetStatus: async (currency?: string): Promise<BudgetWidget | null> => {
    const widgets = await dashboardService.getWidgets(currency);
    return toBudgetWidget(widgets.budget ?? null);
  },
};

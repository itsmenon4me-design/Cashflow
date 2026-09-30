import { apiClient } from "@/lib/axios";
import { categoryService } from "@/services/category.service";
import { transactionService, toTransactionItem } from "@/services/transaction.service";
import { DEFAULT_USER_TIMEZONE } from "@/lib/user-timezone";
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
    comparison: {
      income: number | null;
      expense: number | null;
      netCashFlow: number | null;
    } | null;
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
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

function parseMonth(period: string): { year: number; index: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  return Number.isInteger(year) && month >= 1 && month <= 12
    ? { year, index: month - 1 }
    : null;
}

function currentPeriodInTimezone(
  timeZone: string,
): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  return {
    year: Number(parts.find(({ type }) => type === "year")?.value),
    month: Number(parts.find(({ type }) => type === "month")?.value),
  };
}

export const dashboardService = {
  getSummary: (): Promise<DashboardSummaryResponse> =>
    apiClient.get<DashboardSummaryResponse>("/dashboard/summary"),

  getWidgets: (): Promise<DashboardWidgetsResponse> =>
    apiClient.get<DashboardWidgetsResponse>("/dashboard/widgets"),


  getFlowSeries: async (
    timeZone = DEFAULT_USER_TIMEZONE,
  ): Promise<FlowSeries> => {
    const widgets = await dashboardService.getWidgets();
    if (!widgets.trend) throw new Error("Dashboard trend widget failed");
    const points = widgets.trend.data;
    if (points.length === 0) return { cashFlow: [], flow: [] };

    const currentPeriod = currentPeriodInTimezone(timeZone);
    const year = (points[0] && parseMonth(points[0].period)?.year) ?? currentPeriod.year;
    const monthlyPoints = Array.from({ length: 12 }, (_, index) => ({
      month: MONTH_LABELS[index],
      cashFlow: year === currentPeriod.year && index + 1 > currentPeriod.month ? null : 0,
      income: year === currentPeriod.year && index + 1 > currentPeriod.month ? null : 0,
      expense: year === currentPeriod.year && index + 1 > currentPeriod.month ? null : 0,
    }));

    for (const point of points) {
      const parsedMonth = parseMonth(point.period);
      if (!parsedMonth || parsedMonth.year !== year) continue;
      const { index } = parsedMonth;

      monthlyPoints[index] = {
        month: MONTH_LABELS[index],
        cashFlow: toNumber(point.netCashFlow),
        income: toNumber(point.income),
        expense: toNumber(point.expense),
      };
    }

    return {
      cashFlow: monthlyPoints.map(({ month, cashFlow }) => ({ month, balance: cashFlow })),
      flow: monthlyPoints.map(({ month, income, expense }) => ({ month, income, expense })),
    };
  },

  getCategoryDistribution: async (): Promise<DistributionPoint[]> => {
    const widgets = await dashboardService.getWidgets();
    return (widgets.categoryBreakdown ?? []).map((c) => ({
      name: c.categoryName || "Lainnya",
      value: Math.round((c.percentage ?? 0) * 100) / 100,
      amount: typeof c.totalAmount === 'number' ? c.totalAmount : Number(c.totalAmount) || 0,
    }));
  },


  getRecentTransactions: async (
    limit = 5,
    timeZone = DEFAULT_USER_TIMEZONE,
  ): Promise<TransactionItem[]> => {
    const [page, categories] = await Promise.all([
      transactionService.list({ page: 1, limit }),
      categoryService.list().catch(() => []),
    ]);
    const categoryNames = Object.fromEntries(categories.map((c) => [c.id, c.name]));
    return (page.data ?? []).map((dto) =>
      toTransactionItem(dto, categoryNames, timeZone),
    );
  },

  getBudgetStatus: async (): Promise<BudgetWidget | null> => {
    const widgets = await dashboardService.getWidgets();
    return toBudgetWidget(widgets.budget ?? null);
  },
};

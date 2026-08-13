import { apiClient } from "@/lib/axios";
import type { ReportRange } from "@/features/reports/period";
import type { CategoryBreakdownItem, TrendType, TrendPoint } from "@/services/report.service";

export interface AnalyticsComparison {
  income: number | null;
  expense: number | null;
  netCashFlow: number | null;
  savingRate: number | null;
}

export interface AnalyticsOverview {
  income: string;
  expense: string;
  netCashFlow: string;
  savingRate: number;
  transactions: number;
  comparison: AnalyticsComparison;
}

export interface CategoryRank {
  categoryId: string;
  name: string | null;
  total: string;
  percentage: number;
}

export interface AnalyticsTypeResult {
  total: string;
  transactionCount: number;
  trend: TrendPoint[];
  categories: CategoryBreakdownItem[];
  top: CategoryRank[];
  comparison: number | null;
  biggestCategory: string | null;
  biggestCategoryPercentage: number | null;
}

export interface AnalyticsCashflow {
  trend: TrendPoint[];
  totalIncome: string;
  totalExpense: string;
  netCashFlow: string;
  surplusPeriods: number;
  deficitPeriods: number;
  status: "surplus" | "deficit" | "balanced";
}

export interface AnalyticsSpending {
  avgExpense: string;
  largestExpense: string;
  avgTransaction: string;
  totalTransactions: number;
  incomeTransactions: number;
  expenseTransactions: number;
  byCategory: CategoryBreakdownItem[];
}

export interface AnalyticsHealth {
  score: number;
  label: "healthy" | "moderate" | "risk";
  savingRate: number;
  expenseRatio: number;
  incomeVsExpense: number | null;
  netCashFlow: string;
  cashFlowPositive: boolean;
  spendingConcentration: number;
}

function params(period: ReportRange, granularity?: TrendType): Record<string, unknown> {
  return {
    startDate: period.startDate,
    endDate: period.endDate,
    ...(granularity ? { granularity } : {}),
  };
}

export const analyticsService = {
  getOverview: (period: ReportRange): Promise<AnalyticsOverview> =>
    apiClient.get<AnalyticsOverview>("/analytics/overview", { params: params(period) }),

  getIncome: (period: ReportRange, granularity: TrendType): Promise<AnalyticsTypeResult> =>
    apiClient.get<AnalyticsTypeResult>("/analytics/income", {
      params: params(period, granularity),
    }),

  getExpenses: (period: ReportRange, granularity: TrendType): Promise<AnalyticsTypeResult> =>
    apiClient.get<AnalyticsTypeResult>("/analytics/expenses", {
      params: params(period, granularity),
    }),

  getCashflow: (period: ReportRange, granularity: TrendType): Promise<AnalyticsCashflow> =>
    apiClient.get<AnalyticsCashflow>("/analytics/cashflow", {
      params: params(period, granularity),
    }),

  getSpending: (period: ReportRange): Promise<AnalyticsSpending> =>
    apiClient.get<AnalyticsSpending>("/analytics/spending", { params: params(period) }),

  getFinancialHealth: (period: ReportRange): Promise<AnalyticsHealth> =>
    apiClient.get<AnalyticsHealth>("/analytics/financial-health", {
      params: params(period),
    }),

  getInsights: (period: ReportRange): Promise<string[]> =>
    apiClient.get<string[]>("/analytics/insights", { params: params(period) }),
};
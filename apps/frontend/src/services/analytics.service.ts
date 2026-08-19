import { apiClient } from "@/lib/axios";
import type { ReportRange } from "@/features/reports/period";
import type { CategoryBreakdownItem, TrendType, TrendPoint } from "@/services/report.service";
import { useDashboardCurrencyStore } from "@/stores/dashboardCurrency.store";

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

function params(period: ReportRange, granularity?: TrendType, currency?: string): Record<string, unknown> {
  const activeCurrency = currency ?? useDashboardCurrencyStore.getState().currency;
  return {
    startDate: period.startDate,
    endDate: period.endDate,
    ...(granularity ? { granularity } : {}),
    ...(activeCurrency ? { currency: activeCurrency } : {}),
  };
}

export const analyticsService = {
  getOverview: (period: ReportRange, currency?: string): Promise<AnalyticsOverview> =>
    apiClient.get<AnalyticsOverview>("/analytics/overview", { params: params(period, undefined, currency) }),

  getIncome: (period: ReportRange, granularity: TrendType, currency?: string): Promise<AnalyticsTypeResult> =>
    apiClient.get<AnalyticsTypeResult>("/analytics/income", {
      params: params(period, granularity, currency),
    }),

  getExpenses: (period: ReportRange, granularity: TrendType, currency?: string): Promise<AnalyticsTypeResult> =>
    apiClient.get<AnalyticsTypeResult>("/analytics/expenses", {
      params: params(period, granularity, currency),
    }),

  getCashflow: (period: ReportRange, granularity: TrendType, currency?: string): Promise<AnalyticsCashflow> =>
    apiClient.get<AnalyticsCashflow>("/analytics/cashflow", {
      params: params(period, granularity, currency),
    }),

  getSpending: (period: ReportRange, currency?: string): Promise<AnalyticsSpending> =>
    apiClient.get<AnalyticsSpending>("/analytics/spending", { params: params(period, undefined, currency) }),

  getFinancialHealth: (period: ReportRange, currency?: string): Promise<AnalyticsHealth> =>
    apiClient.get<AnalyticsHealth>("/analytics/financial-health", {
      params: params(period, undefined, currency),
    }),

  getInsights: (period: ReportRange, currency?: string): Promise<string[]> =>
    apiClient.get<string[]>("/analytics/insights", { params: params(period, undefined, currency) }),
};
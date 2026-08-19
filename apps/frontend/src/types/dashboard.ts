export type CurrencyAmount = string;

export type KpiKey = "balance" | "income" | "expense" | "cashflow";

export type TransactionStatus = "completed" | "pending" | "cancelled";

export type TransactionType = "income" | "expense";

export type NotificationType = "bill" | "goal" | "income";

export interface DashboardKpi {
  value: CurrencyAmount;
  change: string;
  trend: number[];
}

export interface CashFlowPoint {
  month: string;
  balance: number;
}

export interface FlowPoint {
  month: string;
  income: number;
  expense: number;
}

export interface DistributionPoint {
  name: string;
  value: number;
  /** total amount in minor units (cents) when available */
  amount?: number;
}

export type AnalyticsRangeKey = "7D" | "30D" | "3M" | "6M" | "1Y" | "ALL";

export interface AnalyticsCashFlowPoint {
  period: string;
  income: number;
  expense: number;
  balance: number;
}

export interface AnalyticsTrendPoint {
  period: string;
  value: number;
}

export interface AnalyticsDataset {
  cashFlow: AnalyticsCashFlowPoint[];
  trend: AnalyticsTrendPoint[];
  avgExpense: number;
  avgIncome: number;
  netCashFlow: number;
  cashFlowPositive: boolean;
  topCategoryName: string;
  topCategoryValue: number;
  granularity: "daily" | "monthly";
}

export interface TransactionItem {
  id: string;
  date: string;
  /** Full ISO timestamp for timezone-aware display (date stays YYYY-MM-DD for forms). */
  dateTime?: string;
  category: string;
  description: string;
  account: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  note?: string;
}

export interface MonthlyTargetItem {
  id: string;
  name: string;
  target: number;
  realized: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  time: string;
  type: NotificationType;
}

export interface AccountItem {
  name: string;
  type: string;
  balance: string;
  inflow: string;
  change: string;
}

export interface UserProfile {
  name: string;
  email: string;
  plan: string;
}

export interface DashboardSummary {
  totalBalance: string;
  monthlyIncome: string;
  monthlyExpenses: string;
  cashFlow: string;
  savingsRate: string;
  netWorth: string;
  financialHealth: string;
}

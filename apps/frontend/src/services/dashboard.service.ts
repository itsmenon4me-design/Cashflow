import { apiClient } from "@/lib/axios";
import type { DashboardSummary, FlowPoint, TransactionItem } from "@/types/dashboard";

export const dashboardService = {
  getSummary: async (): Promise<DashboardSummary> => apiClient.get<DashboardSummary>("/dashboard/summary"),
  getFlowSeries: async (): Promise<FlowPoint[]> => apiClient.get<FlowPoint[]>("/dashboard/flow-series"),
  getRecentTransactions: async (): Promise<TransactionItem[]> => apiClient.get<TransactionItem[]>("/dashboard/recent-transactions"),
};

import { apiClient } from "@/lib/axios";

export const reportService = {
  getOverview: async (): Promise<{ totalRevenue: string; totalExpenses: string }> => apiClient.get<{ totalRevenue: string; totalExpenses: string }>("/reports/overview"),
};

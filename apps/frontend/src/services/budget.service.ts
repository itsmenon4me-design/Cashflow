import { apiClient } from "@/lib/axios";

export const budgetService = {
  list: async (): Promise<{ name: string; progress: number; amount: string }[]> => apiClient.get<{ name: string; progress: number; amount: string }[]>("/budgets"),
};

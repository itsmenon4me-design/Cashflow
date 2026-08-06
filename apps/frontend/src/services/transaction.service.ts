import { apiClient } from "@/lib/axios";
import type { TransactionItem } from "@/types/dashboard";

export const transactionService = {
  list: async (): Promise<TransactionItem[]> => apiClient.get<TransactionItem[]>("/transactions"),
  create: async (payload: TransactionItem): Promise<TransactionItem> => apiClient.post<TransactionItem>("/transactions", payload),
  update: async (id: string, payload: Partial<TransactionItem>): Promise<TransactionItem> => apiClient.patch<TransactionItem>(`/transactions/${id}`, payload),
  remove: async (id: string): Promise<{ success: boolean }> => apiClient.delete<{ success: boolean }>(`/transactions/${id}`),
};

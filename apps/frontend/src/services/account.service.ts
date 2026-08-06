import { apiClient } from "@/lib/axios";
import type { AccountItem } from "@/types/dashboard";

export const accountService = {
  list: async (): Promise<AccountItem[]> => apiClient.get<AccountItem[]>("/accounts"),
};

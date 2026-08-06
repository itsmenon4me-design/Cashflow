import { apiClient } from "@/lib/axios";

export const categoryService = {
  list: async (): Promise<{ name: string; total: number }[]> => apiClient.get<{ name: string; total: number }[]>("/categories"),
};

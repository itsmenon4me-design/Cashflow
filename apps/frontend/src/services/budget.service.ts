import { apiClient } from "@/lib/axios";
import { withOfflineCache } from "@/lib/offline/read-cache";
import { toMajorUnits } from "@/lib/money";

export interface CreateBudgetPayload {
  category_id: string;
  budget_amount_cents: number;
  month: number;
  year: number;
}

export type UpdateBudgetPayload = Partial<CreateBudgetPayload>;

export interface BudgetResponse {
  id: string;
  category_id: string;
  category_name: string | null;
  budget_amount_cents: string;
  month: number;
  year: number;
  created_at: string;
  updated_at: string;
}

export interface BudgetAnalysisCategory {
  categoryId: string;
  categoryName: string | null;
  budgetAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentageUsed: number;
  status: string;
}

export interface BudgetAnalysisResponse {
  month: number;
  year: number;
  overall: {
    budget: number;
    spent: number;
    remaining: number;
    percentageUsed: number;
  };
  categories: BudgetAnalysisCategory[];
}

export interface BudgetItem {
  id: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  spent: number;
  remaining: number;
  percentage: number;
  month: number;
  year: number;
}

export function toBudgetItem(
  budget: BudgetResponse,
  spentByCategory: Record<string, number>,
): BudgetItem {
  const amount = toMajorUnits(BigInt(budget.budget_amount_cents), "IDR");
  const spent = toMajorUnits(BigInt(spentByCategory[budget.category_id] ?? 0), "IDR");
  const percentage =
    amount === 0 ? 0 : Math.min(999, Math.round((spent / amount) * 1000) / 10);
  return {
    id: budget.id,
    categoryId: budget.category_id,
    categoryName: budget.category_name ?? "-",
    amount,
    spent,
    remaining: Math.max(0, amount - spent),
    percentage,
    month: budget.month,
    year: budget.year,
  };
}

export const budgetService = {
  list: async (): Promise<BudgetResponse[]> => {
    const res = await withOfflineCache("budgets", "list", () =>
      apiClient.get<{ success: boolean; data: BudgetResponse[] }>("/budgets"),
    );
    return res.data ?? [];
  },

  get: (id: string): Promise<BudgetResponse> =>
    apiClient
      .get<{ success: boolean; data: BudgetResponse }>(`/budgets/${id}`)
      .then((res) => res.data),

  create: (payload: CreateBudgetPayload): Promise<BudgetResponse> =>
    apiClient
      .post<{ success: boolean; data: BudgetResponse }>("/budgets", payload)
      .then((res) => res.data),

  update: (id: string, payload: UpdateBudgetPayload): Promise<BudgetResponse> =>
    apiClient
      .patch<{ success: boolean; data: BudgetResponse }>(`/budgets/${id}`, payload)
      .then((res) => res.data),

  remove: (id: string): Promise<{ success: boolean }> =>
    apiClient.delete<{ success: boolean }>(`/budgets/${id}`),

  analysis: (month: number, year: number): Promise<BudgetAnalysisResponse> =>
    apiClient.get<BudgetAnalysisResponse>("/reports/budget-analysis", {
      params: { month, year },
    }),
};

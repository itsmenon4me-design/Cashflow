import { apiClient } from "@/lib/axios";
import { withOfflineCache } from "@/lib/offline/read-cache";
import { toMajorUnits, type SupportedCurrency } from "@/lib/money";

export type SupportedEntityCurrency = SupportedCurrency;

export interface CreateBudgetPayload {
  category_id: string;
  currency?: SupportedEntityCurrency;
  budget_amount_cents: number;
  month: number;
  year: number;
}

export type UpdateBudgetPayload = Partial<CreateBudgetPayload>;

export interface BudgetResponse {
  id: string;
  category_id: string;
  category_name: string | null;
  currency?: SupportedEntityCurrency;
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
  const currency = budget.currency ?? "USD";
  const amount = toMajorUnits(BigInt(budget.budget_amount_cents), currency);
  const spent = toMajorUnits(BigInt(spentByCategory[budget.category_id] ?? 0), currency);
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
  list: async (currency?: string): Promise<BudgetResponse[]> => {
    const res = await withOfflineCache("budgets", `list:${currency ?? "all"}`, () =>
      apiClient.get<{ success: boolean; data: BudgetResponse[] }>("/budgets", {
        params: currency ? { currency } : {},
      }),
    );
    return res.data ?? [];
  },

  get: (id: string, currency?: string): Promise<BudgetResponse> =>
    apiClient
      .get<{ success: boolean; data: BudgetResponse }>(`/budgets/${id}`, {
        params: currency ? { currency } : {},
      })
      .then((res) => res.data),

  create: (payload: CreateBudgetPayload): Promise<BudgetResponse> =>
    apiClient
      .post<{ success: boolean; data: BudgetResponse }>("/budgets", payload)
      .then((res) => res.data),

  update: (
    id: string,
    payload: UpdateBudgetPayload,
    currency?: string,
  ): Promise<BudgetResponse> =>
    apiClient
      .patch<{ success: boolean; data: BudgetResponse }>(`/budgets/${id}`, payload, {
        params: currency ? { currency } : {},
      })
      .then((res) => res.data),

  remove: (id: string, currency?: string): Promise<{ success: boolean }> =>
    apiClient.delete<{ success: boolean }>(`/budgets/${id}`, {
      params: currency ? { currency } : {},
    }),

  analysis: (
    month: number,
    year: number,
    currency?: string,
  ): Promise<BudgetAnalysisResponse> =>
    apiClient.get<BudgetAnalysisResponse>("/reports/budget-analysis", {
      params: { month, year, ...(currency ? { currency } : {}) },
    }),
};

import { apiClient } from "@/lib/axios";
import { withOfflineCache } from "@/lib/offline/read-cache";
import { toMajorUnits, type SupportedCurrency } from "@/lib/money";

export type SavingGoalStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";

export type SupportedEntityCurrency = SupportedCurrency;

export interface CreateSavingGoalPayload {
  name: string;
  account_id?: string;
  category_id?: string;
  currency?: SupportedEntityCurrency;
  description?: string;
  target_amount_cents: number;
  current_amount_cents?: number;
  start_date: string;
  target_date: string;
  status?: SavingGoalStatus;
}

export type UpdateSavingGoalPayload = {
  name?: string;
  account_id?: string | null;
  category_id?: string | null;
  currency?: SupportedEntityCurrency;
  description?: string;
  target_amount_cents?: number;
  current_amount_cents?: number;
  start_date?: string;
  target_date?: string;
  status?: SavingGoalStatus;
};

export interface SavingGoalResponse {
  id: string;
  user_id: string;
  account_id: string | null;
  category_id: string | null;
  currency?: SupportedEntityCurrency;
  name: string;
  description: string | null;
  target_amount_cents: string;
  current_amount_cents: string;
  start_date: string;
  target_date: string;
  status: SavingGoalStatus;
  created_at: string;
  updated_at: string;
}

export interface SavingGoalOverview {
  total: number;
  active: number;
  completed: number;
  targetAmount: string;
  currentAmount: string;
  percentageUsed: number;
}

export interface SavingGoalItem {
  id: string;
  name: string;
  description: string | null;
  accountId: string | null;
  categoryId: string | null;
  accountName: string | null;
  categoryName: string | null;
  target: number;
  current: number;
  remaining: number;
  percentage: number;
  startDate: string;
  targetDate: string;
  status: SavingGoalStatus;
}

export function toSavingGoalItem(
  goal: SavingGoalResponse,
  accountNames: Record<string, string>,
  categoryNames: Record<string, string>,
  accountCurrencies: Record<string, string> = {},
): SavingGoalItem {
  const currency =
    goal.currency ??
    (goal.account_id ? accountCurrencies[goal.account_id] ?? "USD" : "USD");
  const target = toMajorUnits(BigInt(goal.target_amount_cents), currency);
  const current = toMajorUnits(BigInt(goal.current_amount_cents), currency);
  const percentage =
    target === 0 ? 0 : Math.min(999, Math.round((current / target) * 1000) / 10);
  return {
    id: goal.id,
    name: goal.name,
    description: goal.description,
    accountId: goal.account_id ?? "",
    categoryId: goal.category_id ?? "",
    accountName: goal.account_id ? (accountNames[goal.account_id] ?? "-") : null,
    categoryName: goal.category_id ? (categoryNames[goal.category_id] ?? "-") : null,
    target,
    current,
    remaining: Math.max(0, target - current),
    percentage,
    startDate: goal.start_date.slice(0, 10),
    targetDate: goal.target_date.slice(0, 10),
    status: goal.status,
  };
}

export const savingGoalService = {
  list: async (currency?: string): Promise<SavingGoalResponse[]> => {
    const res = await withOfflineCache(
      "saving-goals",
      `list:${currency ?? "all"}`,
      () =>
        apiClient.get<{ success: boolean; data: SavingGoalResponse[] }>(
          "/saving-goals",
          { params: currency ? { currency } : {} },
        ),
    );
    return res.data ?? [];
  },

  get: (id: string, currency?: string): Promise<SavingGoalResponse> =>
    apiClient
      .get<{ success: boolean; data: SavingGoalResponse }>(
        `/saving-goals/${id}`,
        { params: currency ? { currency } : {} },
      )
      .then((res) => res.data),

  create: (payload: CreateSavingGoalPayload): Promise<SavingGoalResponse> =>
    apiClient
      .post<{ success: boolean; data: SavingGoalResponse }>("/saving-goals", payload)
      .then((res) => res.data),

  update: (
    id: string,
    payload: UpdateSavingGoalPayload,
    currency?: string,
  ): Promise<SavingGoalResponse> =>
    apiClient
      .patch<{ success: boolean; data: SavingGoalResponse }>(
        `/saving-goals/${id}`,
        payload,
        { params: currency ? { currency } : {} },
      )
      .then((res) => res.data),

  remove: (id: string, currency?: string): Promise<{ success: boolean }> =>
    apiClient.delete<{ success: boolean }>(`/saving-goals/${id}`, {
      params: currency ? { currency } : {},
    }),

  overview: async (currency?: string): Promise<SavingGoalOverview | null> => {
    const res = await apiClient.get<{ success: boolean; data: SavingGoalOverview }>(
      "/saving-goals/overview",
      { params: currency ? { currency } : {} },
    );
    return res.data ?? null;
  },

};

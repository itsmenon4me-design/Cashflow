import { apiClient } from "@/lib/axios";
import { withOfflineCache } from "@/lib/offline/read-cache";
import { toMajorUnits } from "@/lib/money";
import type { AccountResponse, AccountType } from "@/types/backend";

export interface CreateAccountPayload {
  name: string;
  account_type: AccountType;
  currency?: string;
  opening_balance_cents?: number;
  description?: string;
  is_default?: boolean;
}

export type UpdateAccountPayload = Partial<CreateAccountPayload> & {
  is_active?: boolean;
};

export interface AccountItem {
  id: string;
  name: string;
  accountType: string;
  currency: string;
  balance: number;
  openingBalance: number;
  color: string | null;
  description: string | null;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
}

export function toAccountItem(account: AccountResponse): AccountItem {
  return {
    id: account.id,
    name: account.name,
    accountType: account.account_type,
    currency: account.currency,
    balance: toMajorUnits(BigInt(account.current_balance_cents), account.currency),
    openingBalance: toMajorUnits(BigInt(account.opening_balance_cents), account.currency),
    color: account.color,
    description: account.description,
    isActive: account.is_active,
    isDefault: account.is_default,
    createdAt: account.created_at,
  };
}

export const accountService = {
  list: async (): Promise<AccountResponse[]> => {
    const res = await withOfflineCache("accounts", "list", () =>
      apiClient.get<{ success: boolean; data: AccountResponse[] }>("/accounts"),
    );
    return res.data ?? [];
  },

  get: (id: string): Promise<AccountResponse> =>
    apiClient
      .get<{ success: boolean; data: AccountResponse }>(`/accounts/${id}`)
      .then((res) => res.data),

  create: (payload: CreateAccountPayload): Promise<AccountResponse> =>
    apiClient
      .post<{ success: boolean; data: AccountResponse }>("/accounts", payload)
      .then((res) => res.data),

  update: (id: string, payload: UpdateAccountPayload): Promise<AccountResponse> =>
    apiClient
      .patch<{ success: boolean; data: AccountResponse }>(`/accounts/${id}`, payload)
      .then((res) => res.data),

  remove: (id: string): Promise<{ success: boolean }> =>
    apiClient.delete<{ success: boolean }>(`/accounts/${id}`),

  setDefault: (id: string): Promise<{ success: boolean }> =>
    apiClient.patch<{ success: boolean }>(`/accounts/${id}/default`),
};

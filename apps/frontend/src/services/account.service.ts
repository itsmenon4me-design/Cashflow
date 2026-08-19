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
  list: async (currency?: string): Promise<AccountResponse[]> => {
    // keep backward-compatible call signature; server may support currency param
    const key = currency ? `list:currency:${currency}` : "list";
    const res = await withOfflineCache("accounts", key, () =>
      apiClient.get<{ success: boolean; data: AccountResponse[] }>("/accounts", {
        params: currency ? { currency } : {},
      }),
    );
    const items = res.data ?? [];
    // If server doesn't filter by currency, perform client-side filtering when currency provided
    if (currency) {
      return items.filter((a) => a.currency === currency);
    }
    return items;
  },

  get: (id: string, currency?: string): Promise<AccountResponse> =>
    apiClient
      .get<{ success: boolean; data: AccountResponse }>(`/accounts/${id}`, { params: currency ? { currency } : {} })
      .then((res) => res.data),

  create: (payload: CreateAccountPayload, currency?: string): Promise<AccountResponse> =>
    apiClient
      .post<{ success: boolean; data: AccountResponse }>(
        currency ? `/accounts?currency=${encodeURIComponent(currency)}` : "/accounts",
        payload,
      )
      .then((res) => res.data),

  update: (id: string, payload: UpdateAccountPayload, currency?: string): Promise<AccountResponse> =>
    apiClient
      .patch<{ success: boolean; data: AccountResponse }>(
        currency ? `/accounts/${id}?currency=${encodeURIComponent(currency)}` : `/accounts/${id}`,
        payload,
      )
      .then((res) => res.data),

  remove: (id: string, currency?: string): Promise<{ success: boolean }> =>
    apiClient.delete<{ success: boolean }>(
      currency ? `/accounts/${id}?currency=${encodeURIComponent(currency)}` : `/accounts/${id}`,
    ),

  setDefault: (id: string): Promise<{ success: boolean }> =>
    apiClient.patch<{ success: boolean }>(`/accounts/${id}/default`),
};

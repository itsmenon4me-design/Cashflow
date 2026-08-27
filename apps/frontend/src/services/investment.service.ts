import { apiClient } from "@/lib/axios";
import { toMajorUnits, type SupportedCurrency } from "@/lib/money";

export type InvestmentType =
  | "Stock"
  | "Mutual Fund"
  | "Gold"
  | "Crypto"
  | "Bond"
  | "Deposit"
  | "Property"
  | "Other";

export type InvestmentStatus = "ACTIVE" | "SOLD" | "CLOSED";

export type SupportedEntityCurrency = SupportedCurrency;

export interface CreateInvestmentPayload {
  account_id?: string;
  currency?: SupportedEntityCurrency;
  investment_type: InvestmentType;
  platform: string;
  name: string;
  symbol?: string;
  quantity: number;
  average_buy_price: number;
  current_price: number;
  invested_amount_cents?: number;
  notes?: string;
  purchase_date: string;
  status?: InvestmentStatus;
}

export type UpdateInvestmentPayload = {
  account_id?: string | null;
  currency?: SupportedEntityCurrency;
  investment_type?: InvestmentType;
  platform?: string;
  name?: string;
  symbol?: string | null;
  quantity?: number;
  average_buy_price?: number;
  current_price?: number;
  invested_amount_cents?: number;
  notes?: string | null;
  purchase_date?: string;
  status?: InvestmentStatus;
};

export interface InvestmentResponse {
  id: string;
  account_id: string | null;
  currency?: SupportedEntityCurrency;
  investment_type: InvestmentType;
  platform: string;
  name: string;
  symbol: string | null;
  quantity: string;
  average_buy_price: string;
  current_price: string;
  invested_amount_cents: string;
  current_value_cents: string;
  profit_loss_cents: string;
  profit_loss_percentage: string;
  purchase_date: string;
  notes: string | null;
  status: InvestmentStatus;
  created_at: string;
  updated_at: string;
}

export interface InvestmentAllocation {
  type: InvestmentType;
  total: string;
}

export interface InvestmentOverview {
  total: number;
  active: number;
  totalInvested: string;
  totalValue: string;
  totalProfit: string;
  totalLoss: string;
  roi: number;
  allocation: InvestmentAllocation[];
}

export interface InvestmentItem {
  id: string;
  accountId: string | null;
  accountName: string | null;
  type: InvestmentType;
  platform: string;
  name: string;
  symbol: string | null;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  invested: number;
  currentValue: number;
  profitLoss: number;
  profitLossPct: number;
  currency: string;
  purchaseDate: string;
  notes: string | null;
  status: InvestmentStatus;
}

export function toInvestmentItem(
  item: InvestmentResponse,
  accountNames: Record<string, string>,
  accountCurrencies: Record<string, string> = {},
): InvestmentItem {
    const currency =
      item.currency ??
      (item.account_id ? accountCurrencies[item.account_id] ?? "IDR" : "IDR");
  return {
    id: item.id,
    accountId: item.account_id,
    accountName: item.account_id ? (accountNames[item.account_id] ?? "-") : null,
    type: item.investment_type,
    platform: item.platform,
    name: item.name,
    symbol: item.symbol,
    quantity: Number(item.quantity),
    avgPrice: Number(item.average_buy_price),
    currentPrice: Number(item.current_price),
    invested: toMajorUnits(BigInt(item.invested_amount_cents), currency),
    currentValue: toMajorUnits(BigInt(item.current_value_cents), currency),
    profitLoss: toMajorUnits(BigInt(item.profit_loss_cents), currency),
    profitLossPct: Number(item.profit_loss_percentage),
    currency,
    purchaseDate: item.purchase_date.slice(0, 10),
    notes: item.notes,
    status: item.status,
  };
}

export const investmentService = {
  list: async (): Promise<InvestmentResponse[]> => {
    const res = await apiClient.get<{ success: boolean; data: InvestmentResponse[] }>("/investments");
    return res.data ?? [];
  },

  get: (id: string): Promise<InvestmentResponse> =>
    apiClient
      .get<{ success: boolean; data: InvestmentResponse }>(`/investments/${id}`)
      .then((res) => res.data),

  create: (payload: CreateInvestmentPayload): Promise<InvestmentResponse> =>
    apiClient
      .post<{ success: boolean; data: InvestmentResponse }>("/investments", payload)
      .then((res) => res.data),

  update: (
    id: string,
    payload: UpdateInvestmentPayload,
  ): Promise<InvestmentResponse> =>
    apiClient
      .patch<{ success: boolean; data: InvestmentResponse }>(
        `/investments/${id}`,
        payload,
      )
      .then((res) => res.data),

  remove: (id: string): Promise<{ success: boolean }> =>
    apiClient.delete<{ success: boolean }>(`/investments/${id}`),

  overview: async (): Promise<InvestmentOverview | null> => {
    const res = await apiClient.get<{ success: boolean; data: InvestmentOverview }>("/investments/overview");
    return res.data ?? null;
  },
};

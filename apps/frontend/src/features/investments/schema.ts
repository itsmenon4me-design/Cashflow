import { z } from "zod";
import { toMinorUnits } from "@/lib/money";
import { normalizeDashboardCurrency } from "@/lib/dashboard-currency";
import { useDashboardCurrencyStore } from "@/stores/dashboardCurrency.store";

const requiredMessage = "Wajib diisi";

export const investmentFormSchema = z.object({
  accountId: z.string().optional(),
  investmentType: z.enum([
    "Stock",
    "Mutual Fund",
    "Gold",
    "Crypto",
    "Bond",
    "Deposit",
    "Property",
    "Other",
  ]),
  platform: z.string().min(1, requiredMessage),
  name: z.string().min(1, requiredMessage),
  symbol: z.string().optional(),
  quantity: z.number({ error: "Harus berupa angka" }).min(0, "Tidak boleh negatif"),
  averageBuyPrice: z.number({ error: "Harus berupa angka" }).min(0, "Tidak boleh negatif"),
  currentPrice: z.number({ error: "Harus berupa angka" }).min(0, "Tidak boleh negatif"),
  invested: z.number({ error: "Harus berupa angka" }).min(0, "Tidak boleh negatif"),
  purchaseDate: z.string().min(1, requiredMessage),
  notes: z.string().optional(),
  status: z.enum(["ACTIVE", "SOLD", "CLOSED"]),
});

export type InvestmentFormValues = z.infer<typeof investmentFormSchema>;

export function toCreateInvestmentPayload(
  values: InvestmentFormValues,
  currency = normalizeDashboardCurrency(
    useDashboardCurrencyStore.getState().currency,
  ) ?? 'USD',
) {
  return {
    account_id: values.accountId || undefined,
    currency,
    investment_type: values.investmentType,
    platform: values.platform.trim(),
    name: values.name.trim(),
    symbol: values.symbol?.trim() || undefined,
    quantity: values.quantity,
    average_buy_price: values.averageBuyPrice,
    current_price: values.currentPrice,
    invested_amount_cents: toMinorUnits(values.invested, currency),
    notes: values.notes?.trim() || undefined,
    purchase_date: values.purchaseDate,
    status: values.status,
  };
}

export function toUpdateInvestmentPayload(
  values: InvestmentFormValues,
  currency = normalizeDashboardCurrency(
    useDashboardCurrencyStore.getState().currency,
  ) ?? 'USD',
) {
  return {
    ...toCreateInvestmentPayload(values, currency),
    account_id: values.accountId || null,
    symbol: values.symbol?.trim() || null,
    notes: values.notes?.trim() || null,
  };
}
import type { SupportedCurrency } from "@/lib/money";

export const DASHBOARD_CURRENCIES: readonly SupportedCurrency[] = ['IDR'] as const;
export type DashboardCurrency = typeof DASHBOARD_CURRENCIES[number];

export function normalizeDashboardCurrency(
  _currency?: string | null,
): DashboardCurrency {
  return 'IDR';
}

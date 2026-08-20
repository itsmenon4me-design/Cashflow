import { SupportedCurrency } from "@/lib/money";

export const DASHBOARD_CURRENCIES: readonly SupportedCurrency[] = [
  'IDR',
  'USD',
  'SGD',
  'EUR',
  'JPY',
  'VND',
  'MYR',
  'THB',
  'PHP',
  'GBP',
  'AUD',
  'CNY',
  'HKD',
];
export type DashboardCurrency = SupportedCurrency;

export function normalizeDashboardCurrency(
  currency?: string | null,
): DashboardCurrency | undefined {
  if (currency === undefined || currency === null || currency === '') {
    return undefined;
  }

  const normalized = String(currency).trim().toUpperCase();
  if (!(DASHBOARD_CURRENCIES as readonly string[]).includes(normalized)) {
    return undefined;
  }

  return normalized as DashboardCurrency;
}

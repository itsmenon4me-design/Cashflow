import { DASHBOARD_CURRENCIES as SHARED_DASHBOARD_CURRENCIES, SupportedCurrency } from '../../../backend/src/common/currencies';

export const DASHBOARD_CURRENCIES = SHARED_DASHBOARD_CURRENCIES;
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

export const DASHBOARD_CURRENCIES = ['IDR', 'USD', 'SGD', 'EUR'] as const;
export type DashboardCurrency = (typeof DASHBOARD_CURRENCIES)[number];

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

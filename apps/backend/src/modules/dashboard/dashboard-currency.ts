import { BadRequestException } from '@nestjs/common';

export const DASHBOARD_CURRENCIES = ['IDR', 'USD', 'SGD', 'EUR'] as const;
export type DashboardCurrency = (typeof DASHBOARD_CURRENCIES)[number];

export function normalizeDashboardCurrency(
  currency?: string | null,
): DashboardCurrency | undefined {
  if (currency === undefined || currency === null || currency === '') {
    return undefined;
  }

  const normalized = String(currency).trim().toUpperCase();
  if (!DASHBOARD_CURRENCIES.includes(normalized as DashboardCurrency)) {
    throw new BadRequestException(
      `Unsupported dashboard currency: ${currency}. Allowed: ${DASHBOARD_CURRENCIES.join(', ')}`,
    );
  }

  return normalized as DashboardCurrency;
}

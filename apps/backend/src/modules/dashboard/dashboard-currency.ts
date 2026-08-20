import { BadRequestException } from '@nestjs/common';
import { SUPPORTED_CURRENCIES } from '../../common/types/money';

export const DASHBOARD_CURRENCIES = SUPPORTED_CURRENCIES;
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
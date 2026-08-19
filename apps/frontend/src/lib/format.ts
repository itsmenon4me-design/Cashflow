import {
  formatCurrency as formatMajorCurrency,
  formatMoneyFromMinorUnits,
} from "@/lib/money";
import { normalizeDashboardCurrency } from "@/lib/dashboard-currency";
import { DEFAULT_CURRENCY, useDashboardCurrencyStore } from "@/stores/dashboardCurrency.store";

function resolveDisplayCurrency(currency?: string): string {
  const activeCurrency = currency ?? useDashboardCurrencyStore.getState().currency;
  return normalizeDashboardCurrency(activeCurrency) ?? DEFAULT_CURRENCY;
}

/** Format an amount that is already expressed in major units. */
export function formatCurrency(amount: number, currency?: string): string {
  return formatMajorCurrency(amount, resolveDisplayCurrency(currency));
}

/** Format persisted minor units with currency-specific precision and locale. */
export function formatCurrencyCents(amount: string | number | bigint, currency?: string): string {
  return formatMoneyFromMinorUnits(amount, resolveDisplayCurrency(currency));
}

export function formatMoney(amount: number, currency?: string): string {
  return formatCurrency(amount, currency);
}

export function formatCompact(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

export function formatTransactionDate(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  // Use user's locale and timezone (browser environment). If unavailable, fall back to id-ID and system timezone.
  const locale = typeof navigator !== "undefined" && navigator.language ? navigator.language : "id-ID";
  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: tz,
  });

  const timeFormatter = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  });

  return `${dateFormatter.format(parsed)} • ${timeFormatter.format(parsed)}`;
}

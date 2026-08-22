import {
  formatCurrency as formatMajorCurrency,
  formatMoneyFromMinorUnits,
  getCurrencySpec,
  toMajorUnits,
} from "@/lib/money";
import { normalizeDashboardCurrency } from "@/lib/dashboard-currency";
import { DEFAULT_CURRENCY, useDashboardCurrencyStore } from "@/stores/dashboardCurrency.store";

function resolveDisplayCurrency(currency?: string): string {
  const activeCurrency = currency ?? useDashboardCurrencyStore.getState().currency;
  return normalizeDashboardCurrency(activeCurrency) ?? DEFAULT_CURRENCY;
}

/**
 * Single display formatter for monetary values expressed in major units
 * (dollars, rupiah, yen, etc.).
 *
 * Locale and decimal precision are derived from the currency spec, so IDR/JPY
 * render with 0 decimals and USD/SGD/EUR/GBP/AUD/MYR/THB/PHP/CNY/HKD render
 * with 2 decimals - never hardcoded per UI file.
 */
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

/**
 * Compact, currency-aware number for chart axis ticks.
 *
 * Expects a value in minor units (the canonical storage form) and converts to
 * major units before applying the currency locale/notation so the scale label
 * matches the currency (e.g. "Rp1,5jt" for IDR, "$15K" for USD) instead of a
 * hardcoded Indonesian "…jt" suffix or locale.
 */
export function formatCompactCurrency(value: number, currency?: string): string {
  const resolved = resolveDisplayCurrency(currency);
  const spec = getCurrencySpec(resolved);
  const majorUnits = toMajorUnits(Number.isFinite(value) ? value : 0, resolved);
  try {
    // Log where this formatter runs (server vs client) for hydration diagnostics only.
    if (typeof window === 'undefined') {
      // eslint-disable-next-line no-console
      console.trace('[format] formatCompactCurrency running on server', { resolved, locale: spec.primaryLocale, ts: Date.now() });
    } else {
      // eslint-disable-next-line no-console
      console.trace('[format] formatCompactCurrency running on client', { resolved, locale: spec.primaryLocale, ts: Date.now() });
    }
  } catch (e) {}
  return new Intl.NumberFormat(spec.primaryLocale, {
    style: "currency",
    currency: spec.code,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(majorUnits);
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
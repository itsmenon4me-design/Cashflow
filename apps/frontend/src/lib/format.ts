import {
  formatCurrency as formatMajorCurrency,
  formatMoneyFromMinorUnits,
} from "@/lib/money";

/** Format an amount that is already expressed in major units. */
export function formatCurrency(amount: number, currency = "IDR"): string {
  return formatMajorCurrency(amount, currency);
}

/** Format persisted minor units with currency-specific precision and locale. */
export function formatCurrencyCents(amount: string | number | bigint, currency = "IDR"): string {
  return formatMoneyFromMinorUnits(amount, currency);
}

export function formatMoney(amount: number, currency = "IDR"): string {
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

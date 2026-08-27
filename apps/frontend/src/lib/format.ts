import {
  formatCurrency as formatMajorCurrency,
  formatMoneyFromMinorUnits,
  getCurrencySpec,
  toMajorUnits,
} from "@/lib/money";

const IDR = 'IDR';

export function formatCurrency(amount: number, _currency?: string): string {
  return formatMajorCurrency(amount, IDR);
}

export function formatCurrencyCents(amount: string | number | bigint, _currency?: string): string {
  return formatMoneyFromMinorUnits(amount, IDR);
}

export function formatMoney(amount: number, _currency?: string): string {
  return formatCurrency(amount, IDR);
}

export function formatCompactCurrency(value: number, _currency?: string): string {
  const spec = getCurrencySpec(IDR);
  const majorUnits = toMajorUnits(Number.isFinite(value) ? value : 0, IDR);

  return new Intl.NumberFormat(spec.primaryLocale, {
    style: "currency",
    currency: spec.code,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(majorUnits);
}

// Single source of truth for app-wide date/time rendering.
// Fixed locale + timezone so SSR and CSR produce identical output.
export const APP_LOCALE = "id-ID";
export const APP_TIME_ZONE = "Asia/Jakarta";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

const dateFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: APP_TIME_ZONE,
});

const timeFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: APP_TIME_ZONE,
});

const fullDateFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: APP_TIME_ZONE,
});

/** "Senin, 24 Agustus 2026" — top bar / headings. */
export function formatFullDate(date: Date = new Date()): string {
  return fullDateFormatter.format(date);
}

/**
 * "24 Agu 2026" or "24 Agu 2026 • 19.02".
 * Date-only inputs (YYYY-MM-DD) render without a time part.
 */
export function formatTransactionDate(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  if (DATE_ONLY_RE.test(date)) {
    return dateFormatter.format(parsed);
  }
  return `${dateFormatter.format(parsed)} • ${timeFormatter.format(parsed)}`;
}

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
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(majorUnits);
}

// Single source of truth for app-wide date/time rendering.
// Fixed locale + timezone so SSR and CSR produce identical output.
export const APP_LOCALE = "id-ID";
export const APP_TIME_ZONE = "Asia/Jakarta";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

const fullDateFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: APP_TIME_ZONE,
});

const transactionFormatterCache = new Map<
  string,
  { date: Intl.DateTimeFormat; time: Intl.DateTimeFormat }
>();

function transactionFormatters(timeZone: string) {
  let formatters = transactionFormatterCache.get(timeZone);
  if (!formatters) {
    formatters = {
      date: new Intl.DateTimeFormat(APP_LOCALE, {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone,
      }),
      time: new Intl.DateTimeFormat(APP_LOCALE, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone,
      }),
    };
    transactionFormatterCache.set(timeZone, formatters);
  }
  return formatters;
}

/** "Senin, 24 Agustus 2026" — top bar / headings. */
export function formatFullDate(date: Date = new Date()): string {
  return fullDateFormatter.format(date);
}

/**
 * "24 Agu 2026" or "24 Agu 2026 • 19.02".
 * Date-only inputs (YYYY-MM-DD) render without a time part.
 */
export function formatTransactionDate(
  date: string,
  timeZone = APP_TIME_ZONE,
): string {
  const parsed = new Date(
    DATE_ONLY_RE.test(date) ? `${date}T12:00:00.000Z` : date,
  );
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  const formatters = transactionFormatters(timeZone);
  if (DATE_ONLY_RE.test(date)) {
    return formatters.date.format(parsed);
  }
  return `${formatters.date.format(parsed)} • ${formatters.time.format(parsed)}`;
}

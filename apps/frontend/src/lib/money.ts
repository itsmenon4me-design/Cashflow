/**
 * Frontend Money and Currency Utilities
 * 
 * Browser-based parsing and formatting that mirrors backend logic.
 * Critical for maintaining exact monetary values across frontend and backend.
 */

/**
 * Currency specification for frontend.
 * Mirrors backend structure but optimized for browser usage.
 */
import { CURRENCY_SPECS as SHARED_CURRENCY_SPECS, getCurrencySpec as getCurrencySpecShared, SupportedCurrency as SharedSupportedCurrency, CurrencySpec as SharedCurrencySpec } from "../../../backend/src/common/currencies";

export type CurrencySpec = SharedCurrencySpec;
export const CURRENCY_SPECS: Record<string, CurrencySpec> = SHARED_CURRENCY_SPECS;

/** Union of every supported ISO-4217 code. */
export type SupportedCurrency = SharedSupportedCurrency;

/** Every ISO-4217 code the app can display/format. */
export const SUPPORTED_CURRENCIES: readonly string[] = Object.keys(CURRENCY_SPECS);

export function getCurrencySpec(code: string | undefined): CurrencySpec {
  return getCurrencySpecShared(code);
}

export function getCurrencySpec(code: string | undefined): CurrencySpec {
  if (!code) {
    return CURRENCY_SPECS.IDR;
  }
  const spec = CURRENCY_SPECS[code.toUpperCase()];
  if (!spec) {
    throw new Error(`Unsupported currency: ${code}`);
  }
  return spec;
}

/**
 * Parse currency amount from user input, respecting currency rules.
 * 
 * Returns the amount in major units (dollars, rupiah, etc.) as a number.
 * This is what the form fields use.
 * 
 * @param input - User input string
 * @param currency - Currency code (IDR, USD, SGD, EUR)
 * @param locale - Optional locale for parsing hints
 * 
 * @returns Amount in major units (e.g., 1.23 for $1.23 USD, 1000000 for 1M IDR)
 */
export function parseMoneyInput(
  input: string,
  currency: string,
  locale?: string,
): number {
  if (!input || typeof input !== 'string') {
    return 0;
  }

  const spec = getCurrencySpec(currency);
  const activeLocale = locale || spec.primaryLocale;
  const usesCommaAsDecimal = /^(de|fr|it|pt|id)/.test(activeLocale);

  let cleaned = input
    .replace(/[$€SRp]/g, '') // Remove currency symbols and Rp prefix
    .trim();

  if (!cleaned) {
    return 0;
  }

  if (currency === 'IDR') {
    // IDR has no fractional minor units; dots and commas are grouping separators
    cleaned = cleaned.replace(/[.,]/g, '');
    const value = parseInt(cleaned, 10);
    return isNaN(value) ? 0 : value;
  }

  // Decimal currencies
  if (usesCommaAsDecimal) {
    cleaned = cleaned.replace(/\./g, '');
    cleaned = cleaned.replace(/,/, '.');
  } else {
    cleaned = cleaned.replace(/,/g, '');
  }

  const value = parseFloat(cleaned);
  return isNaN(value) ? 0 : value;
}

/**
 * Format amount in minor units (cents, rupiah) for display.
 * 
 * This is how amounts are stored in the database (BigInt/number in minor units).
 * Use this to display stored amounts in the correct locale.
 * 
 * @param amount - Amount in minor units (BigInt or number)
 * @param currency - Currency code (defaults to IDR)
 * 
 * @returns Formatted string (e.g., "Rp 1.000.000" or "$1,234.56")
 */
export function formatMoneyFromMinorUnits(
  amount: string | number | bigint,
  currency = 'IDR',
): string {
  const spec = getCurrencySpec(currency);

  let normalized: bigint;
  try {
    normalized = typeof amount === 'bigint'
      ? amount
      : typeof amount === 'number'
        ? BigInt(Math.trunc(amount))
        : BigInt(amount.trim() || '0');
  } catch {
    normalized = BigInt(0);
  }

  return formatMinorUnitsExactly(normalized, spec);
}

/**
 * Formats database minor units without converting the monetary value to Number.
 * Intl supplies the locale/currency placement; integer and fraction digits are
 * assembled from BigInt so values above Number.MAX_SAFE_INTEGER stay exact.
 */
function formatMinorUnitsExactly(amount: bigint, spec: CurrencySpec): string {
  const formatter = new Intl.NumberFormat(spec.primaryLocale, {
    style: 'currency',
    currency: spec.code,
    minimumFractionDigits: spec.minorUnits,
    maximumFractionDigits: spec.minorUnits,
  });
  const positiveParts = formatter.formatToParts(0);
  const negativeParts = formatter.formatToParts(-0);
  const negative = amount < BigInt(0);
  const absolute = (negative ? -amount : amount).toString();
  const padded = absolute.padStart(spec.minorUnits + 1, '0');
  const integerDigits = spec.minorUnits === 0
    ? padded
    : padded.slice(0, -spec.minorUnits);
  const fractionDigits = spec.minorUnits === 0
    ? ''
    : padded.slice(-spec.minorUnits);
const groupProbe = formatter.formatToParts(98765.5);
  const group = groupProbe.find((part) => part.type === 'group')?.value ?? ',';
  const decimal = positiveParts.find((part) => part.type === 'decimal')?.value ?? '.';
  const groupedInteger = integerDigits.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  const parts = negative ? negativeParts : positiveParts;

  // Some locales insert a separator literal between the currency symbol and the
  // number (e.g. id-ID "Rp\u00A01"). Drop a space immediately following the
  // currency symbol so IDR renders as "Rp1.000" while trailing-symbol locales
  // like EUR ("17,47 €") keep their spacing.
  const normalizedParts = parts.filter((part, index) => {
    const previous = parts[index - 1];
    return !(
      part.type === 'literal' &&
      previous?.type === 'currency' &&
      (part.value === ' ' || part.value === '\u00A0')
    );
  });

  return normalizedParts.map((part) => {
    if (part.type === 'integer') return groupedInteger;
    if (part.type === 'fraction') return fractionDigits;
    if (part.type === 'decimal') return decimal;
    return part.value;
  }).join('');
}

/**
 * Format amount in major units for display.
 * 
 * Use this when you already have an amount in major units.
 * 
 * @param amount - Amount in major units (dollars, rupiah, etc.)
 * @param currency - Currency code (defaults to IDR)
 * 
 * @returns Formatted string
 */
export function formatCurrency(amount: number, currency = 'IDR'): string {
  const spec = getCurrencySpec(currency);

  return new Intl.NumberFormat(spec.primaryLocale, {
    style: 'currency',
    currency: spec.code,
    maximumFractionDigits: spec.minorUnits,
    minimumFractionDigits: spec.minorUnits,
  }).format(amount);
}

/**
 * Convert amount from major units to minor units for storage.
 * 
 * This MUST be called when preparing data for the API/database.
 * 
 * @param majorUnits - Amount in major units (from form input)
 * @param currency - Currency code
 * 
 * @returns Amount in minor units as integer (for BigInt conversion)
 * 
 * @example
 * toMinorUnits(1000000, 'IDR') → 1000000 (no multiplication for IDR)
 * toMinorUnits(1.23, 'USD') → 123 (multiply by 100 for USD)
 * toMinorUnits(1.23, 'SGD') → 123 (multiply by 100 for SGD)
 */
export function toMinorUnits(majorUnits: number, currency: string): number {
  const spec = getCurrencySpec(currency);
  const multiplier = Math.pow(10, spec.minorUnits);
  return Math.round(majorUnits * multiplier);
}

/**
 * Convert amount from minor units to major units for display.
 * 
 * Reverse of toMinorUnits.
 * 
 * @param minorUnits - Amount in minor units (from database)
 * @param currency - Currency code
 * 
 * @returns Amount in major units as number
 * 
 * @example
 * toMajorUnits(1000000, 'IDR') → 1000000 (no division for IDR)
 * toMajorUnits(123, 'USD') → 1.23 (divide by 100 for USD)
 * toMajorUnits(123, 'SGD') → 1.23 (divide by 100 for SGD)
 */
export function toMajorUnits(minorUnits: number | bigint, currency: string): number {
  const spec = getCurrencySpec(currency);
  const divisor = Math.pow(10, spec.minorUnits);
  const amount = typeof minorUnits === 'bigint' ? Number(minorUnits) : minorUnits;
  return amount / divisor;
}

/**
 * Extract numeric digits from input string.
 * 
 * Used by MoneyInput component for extracting pure numeric value.
 * 
 * @param value - Input string
 * @returns String of digits only
 * 
 * @example
 * extractDigits("Rp1.000.000") → "1000000"
 * extractDigits("$1,234.56") → "123456"
 */
export function extractDigits(value: string): string {
  return (value || '').replace(/[^\d]/g, '');
}

/**
 * Format rupiah string with thousand separators.
 * 
 * Used by MoneyInput for display purposes only.
 * Does NOT change the numeric value.
 * 
 * @param digits - String of digits (no separators)
 * @returns Formatted string with dots as separators
 * 
 * @example
 * formatRupiah("1000000") → "1.000.000"
 * formatRupiah("123") → "123"
 */
export function formatRupiah(digits: string): string {
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

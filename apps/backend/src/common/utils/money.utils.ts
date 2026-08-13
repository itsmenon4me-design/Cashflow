/**
 * Money Utilities: Parsing and Formatting
 *
 * Provides currency-aware parsing from user input and formatting for display.
 * Critical for maintaining exact monetary values across the application.
 */

import { getCurrencySpec, Money } from '../types/money';

/**
 * Parse user input string to Money value, respecting locale and currency rules.
 *
 * Handles multiple input formats:
 * - IDR: "1.000.000", "1000000"
 * - USD: "1,234.56", "1234.56"
 * - SGD: "1,234.56", "1234.56"
 * - EUR: "1.234,56", "1234,56" (depending on locale)
 *
 * @param input - Raw user input string (may contain separators and symbols)
 * @param currency - Currency code (IDR, USD, SGD, EUR)
 * @param locale - Optional locale for parsing hints (defaults to currency primary locale)
 *
 * @returns Money value parsed from input
 *
 * @throws Error if input cannot be parsed
 */
export function parseMoneyInput(
  input: string,
  currency: string,
  locale?: string,
): Money {
  if (!input || typeof input !== 'string') {
    return Money.from(0, currency);
  }

  const spec = getCurrencySpec(currency);
  const primaryLocale = spec.primaryLocale;
  const activeLocale = locale || primaryLocale;

  // Remove currency symbols and Rp prefix
  let cleaned = input.replace(/[$€SRp]/g, '').trim();

  if (!cleaned) {
    return Money.from(0, currency);
  }

  // Determine decimal and thousands separators based on locale
  // Common pattern: locale with 'de', 'fr', 'it', 'pt' use comma as decimal
  const usesCommaAsDecimal = /^(de|fr|it|pt|id)/.test(activeLocale);

  // For IDR, separators are dots: 1.000.000 or 1000000
  if (currency === 'IDR') {
    // IDR has no fractional minor units. Dots and commas are both grouping
    // separators here; an optional leading minus is kept for negative input.
    cleaned = cleaned.replace(/[.,]/g, '');
    if (!/^-?\d+$/.test(cleaned)) {
      throw new Error(`Cannot parse "${input}" as ${currency}`);
    }
    return Money.from(parseInt(cleaned, 10), currency);
  }

  // For decimal currencies (USD, SGD, EUR)
  let majorUnits: number;

  if (usesCommaAsDecimal) {
    // Locale: de-DE, id-ID, etc.
    // Format: 1.234,56 (dot = thousands, comma = decimal)
    cleaned = cleaned.replace(/\./g, ''); // Remove thousands separators (dots)
    cleaned = cleaned.replace(/,/, '.'); // Convert comma decimal to dot for parsing
    majorUnits = parseFloat(cleaned);
  } else {
    // Locale: en-US, en-SG, etc.
    // Format: 1,234.56 (comma = thousands, dot = decimal)
    cleaned = cleaned.replace(/,/g, ''); // Remove thousands separators (commas)
    majorUnits = parseFloat(cleaned);
  }

  if (isNaN(majorUnits)) {
    throw new Error(`Cannot parse "${input}" as ${currency}`);
  }

  return Money.from(majorUnits, currency);
}

/**
 * Format Money for display using the currency's primary locale.
 *
 * Uses Intl.NumberFormat for correct locale-specific formatting.
 *
 * @param money - Money value to format
 * @returns Formatted string (e.g., "Rp 1.000.000" or "$1,234.56")
 */
export function formatMoney(money: Money): string {
  const spec = getCurrencySpec(money.getCurrency());
  const formatter = new Intl.NumberFormat(spec.primaryLocale, {
    style: 'currency',
    currency: money.getCurrency(),
    maximumFractionDigits: spec.minorUnits,
    minimumFractionDigits: spec.minorUnits,
  });
  const negative = money.getMinorUnits() < 0n;
  const absolute = (
    negative ? -money.getMinorUnits() : money.getMinorUnits()
  ).toString();
  const padded = absolute.padStart(spec.minorUnits + 1, '0');
  const integerDigits =
    spec.minorUnits === 0 ? padded : padded.slice(0, -spec.minorUnits);
  const fractionDigits =
    spec.minorUnits === 0 ? '' : padded.slice(-spec.minorUnits);
  const positiveParts = formatter.formatToParts(0);
  const sampleParts = formatter.formatToParts(1000000);
  const parts = negative ? formatter.formatToParts(-0) : positiveParts;
  const group =
    sampleParts.find((part) => part.type === 'group')?.value ??
    (spec.primaryLocale === 'id-ID' ? '.' : ',');
  const decimal =
    positiveParts.find((part) => part.type === 'decimal')?.value ?? '.';
  const groupedInteger = integerDigits.replace(/\B(?=(\d{3})+(?!\d))/g, group);

  return parts
    .map((part) => {
      if (part.type === 'integer') return groupedInteger;
      if (part.type === 'fraction') return fractionDigits;
      if (part.type === 'decimal') return decimal;
      return part.value;
    })
    .join('');
}

/**
 * Format amount in minor units (cents, rupiah, etc.) for display.
 *
 * This is the common pattern used throughout the system where amounts
 * are stored in minor units (as BigInt or number) but need to be displayed
 * in the correct locale.
 *
 * @param amount - Amount in minor units (BigInt or number)
 * @param currency - Currency code
 *
 * @returns Formatted string (e.g., "Rp 1.000.000" or "$1,234.56")
 */
export function formatMoneyFromMinorUnits(
  amount: bigint | number | string,
  currency: string,
): string {
  const money = new Money(
    typeof amount === 'string' ? BigInt(amount) : amount,
    currency,
  );
  return formatMoney(money);
}

/**
 * Format a number as currency using Intl.NumberFormat.
 *
 * This is appropriate ONLY when you already have a major units value
 * and just need to format it for display (e.g., from Intl or pre-calculated).
 *
 * DO NOT use this for amounts stored in the database - use formatMoneyFromMinorUnits instead.
 *
 * @param majorUnits - Amount in major units (dollars, rupiah, etc.)
 * @param currency - Currency code
 *
 * @returns Formatted string
 */
export function formatCurrency(majorUnits: number, currency: string): string {
  const spec = getCurrencySpec(currency);

  return new Intl.NumberFormat(spec.primaryLocale, {
    style: 'currency',
    currency,
    maximumFractionDigits: spec.minorUnits,
    minimumFractionDigits: spec.minorUnits,
  }).format(majorUnits);
}

/**
 * Convert amount from one currency to another using an exchange rate.
 *
 * Important: This converts the numeric value, NOT the currency identity.
 * The original amount is NOT modified - a new Money value is returned.
 *
 * @param money - Money value in source currency
 * @param targetCurrency - Target currency code
 * @param exchangeRate - Rate from source to target (how many target units per source unit)
 *
 * @returns New Money value in target currency
 *
 * @throws Error if target currency not supported
 */
export function convertCurrency(
  money: Money,
  targetCurrency: string,
  exchangeRate: number,
): Money {
  getCurrencySpec(targetCurrency); // Validate target currency

  const sourceMajorUnits = money.getMajorUnits();
  const targetMajorUnits = sourceMajorUnits * exchangeRate;

  return Money.from(targetMajorUnits, targetCurrency);
}

/**
 * Extract numeric digits from a string (used for MoneyInput component).
 *
 * Removes all non-numeric characters, returning just the digits.
 * Useful for input fields that format as user types.
 *
 * @param value - Input string that may contain separators and symbols
 * @returns String containing only digits
 *
 * @example
 * extractDigits("Rp1.000.000") → "1000000"
 * extractDigits("$1,234.56") → "123456"
 */
export function extractDigits(value: string): string {
  return (value || '').replace(/[^\d]/g, '');
}

/**
 * Format rupiah string with thousand separators (dots).
 *
 * Used by MoneyInput for display purposes only.
 *
 * @param digits - String of digits (no separators)
 * @returns Formatted string with dots as thousand separators
 *
 * @example
 * formatRupiah("1000000") → "1.000.000"
 * formatRupiah("123") → "123"
 */
export function formatRupiah(digits: string): string {
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

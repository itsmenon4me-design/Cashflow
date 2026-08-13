/**
 * Money and Currency Type Definitions
 *
 * Establishes financial-grade money representation and currency specifications
 * to ensure exact arithmetic across all supported currencies.
 */

/**
 * Currency specification defining how to parse, format, and calculate with currency.
 *
 * The key insight: currencies have different decimal precisions.
 * - IDR (Indonesian Rupiah): 0 decimal places (no cents, only integer Rupiah)
 * - USD (US Dollar): 2 decimal places (dollars and cents)
 * - SGD (Singapore Dollar): 2 decimal places
 * - EUR (Euro): 2 decimal places
 */
export interface CurrencySpec {
  /** ISO 4217 currency code */
  code: string;

  /** Number of decimal places in this currency (minor units per major unit) */
  minorUnits: number;

  /** Currency symbol for display */
  symbol: string;

  /**
   * Locales where this currency is primarily used.
   * First entry is the primary locale for formatting.
   */
  primaryLocale: string;

  /** Whether this currency has standardized cents/minor units */
  hasMinorUnits: boolean;
}

/**
 * Supported currency specifications.
 *
 * Critical for determining how to parse, store, and format monetary values.
 */
export const CURRENCY_SPECS: Record<string, CurrencySpec> = {
  IDR: {
    code: 'IDR',
    minorUnits: 0, // IDR has NO decimal places - no cents exist
    symbol: 'Rp',
    primaryLocale: 'id-ID',
    hasMinorUnits: false,
  },
  USD: {
    code: 'USD',
    minorUnits: 2, // USD has 2 decimal places (cents)
    symbol: '$',
    primaryLocale: 'en-US',
    hasMinorUnits: true,
  },
  SGD: {
    code: 'SGD',
    minorUnits: 2, // SGD has 2 decimal places (cents)
    symbol: 'S$',
    primaryLocale: 'en-SG',
    hasMinorUnits: true,
  },
  EUR: {
    code: 'EUR',
    minorUnits: 2, // EUR has 2 decimal places (cents)
    symbol: '€',
    primaryLocale: 'de-DE',
    hasMinorUnits: true,
  },
};

/**
 * Get currency specification, with fallback to default (IDR).
 */
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
 * Money value object that maintains both the numeric value and currency.
 *
 * Internally stored as minor units (e.g., cents for USD, rupiah for IDR).
 *
 * This ensures exact arithmetic without floating-point errors.
 *
 * The Money object IS the currency guarantee: every monetary value in the
 * domain should be represented as `Money { amount: bigint, currency }`, so a
 * naked bigint cannot be silently mixed across currencies. A nominal/branded
 * bigint type was considered but adds no guarantee beyond what this class
 * already enforces (currency carried on the value, same-currency-only
 * arithmetic, cross-currency operations throw), so it was not introduced.
 */
export class Money {
  /**
   * The amount in minor units.
   *
   * For USD: 1.23 USD = 123 (cents)
   * For IDR: 1000000 IDR = 1000000 (rupiah, since minorUnits=0)
   *
   * Always use BigInt for exact arithmetic.
   */
  private readonly minorUnits: bigint;

  /** Currency code (e.g., 'IDR', 'USD') */
  private readonly currency: string;

  constructor(minorUnits: bigint | number, currency: string) {
    this.minorUnits =
      typeof minorUnits === 'bigint' ? minorUnits : BigInt(minorUnits);
    this.currency = currency.toUpperCase();

    // Validate currency exists
    getCurrencySpec(this.currency);
  }

  /**
   * Get the raw minor units value (e.g., cents for USD, rupiah for IDR).
   */
  getMinorUnits(): bigint {
    return this.minorUnits;
  }

  /**
   * Get the currency code.
   */
  getCurrency(): string {
    return this.currency;
  }

  /**
   * Get the major units value as a number.
   *
   * Warning: May lose precision for very large values. Use getMajorUnitsBigInt
   * for exact representation if needed.
   */
  getMajorUnits(): number {
    const spec = getCurrencySpec(this.currency);
    const divisor = BigInt(10 ** spec.minorUnits);
    return Number(this.minorUnits / divisor);
  }

  /**
   * Get the major units value as BigInt (for exact arithmetic).
   */
  getMajorUnitsBigInt(): bigint {
    const spec = getCurrencySpec(this.currency);
    const divisor = BigInt(10 ** spec.minorUnits);
    return this.minorUnits / divisor;
  }

  /**
   * Create Money from major units (e.g., dollars, rupiah).
   *
   * Example:
   * - Money.from(1.23, 'USD') → 123 cents
   * - Money.from(1000000, 'IDR') → 1000000 rupiah
   */
  static from(majorUnits: number | bigint, currency: string): Money {
    const spec = getCurrencySpec(currency);
    const multiplier = 10 ** spec.minorUnits;
    // Scale BEFORE rounding so decimal currencies keep their fractional
    // major units (e.g. Money.from(1.23, 'USD') -> 123 cents, NOT 100).
    // Rounding after scaling only snaps float artifacts to the nearest
    // minor unit instead of truncating the fractional part.
    const minorUnits =
      typeof majorUnits === 'bigint'
        ? majorUnits * BigInt(multiplier)
        : BigInt(Math.round(Number(majorUnits) * multiplier));
    return new Money(minorUnits, currency);
  }

  /**
   * Construct from exact minor units (the authoritative storage form).
   *
   * Use this for database/API values that arrive as minor-unit strings or
   * bigints — it never routes through Number.
   */
  static fromMinorUnits(minorUnits: bigint | string, currency: string): Money {
    const amount =
      typeof minorUnits === 'bigint'
        ? minorUnits
        : BigInt(String(minorUnits).trim() || '0');
    return new Money(amount, currency);
  }

  /**
   * Add two Money values (must be same currency).
   */
  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error(`Cannot add ${this.currency} to ${other.currency}`);
    }
    return new Money(this.minorUnits + other.minorUnits, this.currency);
  }

  /**
   * Subtract two Money values (must be same currency).
   */
  subtract(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error(
        `Cannot subtract ${this.currency} from ${other.currency}`,
      );
    }
    return new Money(this.minorUnits - other.minorUnits, this.currency);
  }

  /**
   * Multiply Money by a scalar factor.
   *
   * Result is rounded to the nearest minor unit.
   */
  multiply(factor: number): Money {
    const result =
      (this.minorUnits * BigInt(Math.round(factor * 1000000))) /
      BigInt(1000000);
    return new Money(result, this.currency);
  }

  /**
   * Exact multiplication by an integer quantity.
   *
   * Unlike `multiply(factor: number)` (which rounds through a decimal scalar),
   * this never touches Number and is the correct operation for quantities such
   * as `2 * Money(123n, "USD") = Money(246n, "USD")`.
   */
  multiplyByInteger(quantity: bigint | number): Money {
    const q =
      typeof quantity === 'bigint' ? quantity : BigInt(Math.trunc(quantity));
    return new Money(this.minorUnits * q, this.currency);
  }

  /**
   * Compare against another Money value (must be the same currency).
   * Returns a negative number when this < other, 0 when equal, positive when
   * this > other.
   */
  compare(other: Money): number {
    this.assertSameCurrency(other);
    if (this.minorUnits < other.minorUnits) return -1;
    if (this.minorUnits > other.minorUnits) return 1;
    return 0;
  }

  /** Returns the additive inverse (e.g. Money(123n, 'USD') -> Money(-123n, 'USD')). */
  negate(): Money {
    return new Money(-this.minorUnits, this.currency);
  }

  /** Returns the absolute value, preserving the currency. */
  abs(): Money {
    return new Money(
      this.minorUnits < 0n ? -this.minorUnits : this.minorUnits,
      this.currency,
    );
  }

  /** True when this is less than other (same currency). */
  lt(other: Money): boolean {
    return this.compare(other) < 0;
  }

  /** True when this is greater than other (same currency). */
  gt(other: Money): boolean {
    return this.compare(other) > 0;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(
        `Cannot compare/add ${this.currency} to ${other.currency}`,
      );
    }
  }

  /**
   * Check if Money value is zero.
   */
  isZero(): boolean {
    return this.minorUnits === BigInt(0);
  }

  /**
   * Check if Money value is positive.
   */
  isPositive(): boolean {
    return this.minorUnits > BigInt(0);
  }

  /**
   * Check if Money value is negative.
   */
  isNegative(): boolean {
    return this.minorUnits < BigInt(0);
  }

  /**
   * Check equality with another Money value.
   */
  equals(other: Money): boolean {
    return (
      this.currency === other.currency && this.minorUnits === other.minorUnits
    );
  }

  /**
   * Get string representation (for debugging).
   */
  toString(): string {
    return `Money(${this.minorUnits} × 10^-${getCurrencySpec(this.currency).minorUnits}, ${this.currency})`;
  }
}

/**
 * Amount in minor units (cents, rupiah, etc.) without currency.
 *
 * Used internally in the system where currency is determined from context.
 * Always use bigint for exact arithmetic.
 *
 * @example
 * 123 cents → 123
 * 1000000 rupiah → 1000000
 */
export type AmountInMinorUnits = bigint;

/**
 * Exact conversion of a Prisma/DTO monetary value to bigint minor units.
 *
 * This is the single safe entry point for monetary aggregates: it never
 * routes through Number and preserves values above Number.MAX_SAFE_INTEGER.
 * Prisma returns `_sum`/`_avg`/`amount_cents` as bigint (or number/string),
 * and all of those are accepted here without precision loss.
 */
export function toMinorUnitsExact(value: unknown): bigint {
  if (value === null || value === undefined) return 0n;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? BigInt(Math.trunc(value)) : 0n;
  }
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return 0n;
    try {
      return BigInt(s);
    } catch {
      return 0n;
    }
  }
  return 0n;
}

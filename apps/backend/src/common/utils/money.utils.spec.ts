import { Money } from '../types/money';
import { parseMoneyInput } from './money.utils';

describe('Money.from (minor-unit scaling)', () => {
  it('IDR is scaled by x1 (no decimal places)', () => {
    expect(Money.from(1, 'IDR').getMinorUnits()).toBe(1n);
    expect(Money.from(17, 'IDR').getMinorUnits()).toBe(17n);
    expect(Money.from(999, 'IDR').getMinorUnits()).toBe(999n);
    expect(Money.from(1000, 'IDR').getMinorUnits()).toBe(1000n);
    expect(Money.from(1001, 'IDR').getMinorUnits()).toBe(1001n);
    expect(Money.from(1234567, 'IDR').getMinorUnits()).toBe(1234567n);
  });

  it('REGRESSION: 1.000.000 IDR must NOT become 100.000.000', () => {
    expect(Money.from(1000000, 'IDR').getMinorUnits()).toBe(1000000n);
    expect(Money.from(1000000, 'IDR').getMinorUnits()).not.toBe(100000000n);
  });

  it('USD is scaled by x100 (2 decimal places)', () => {
    expect(Money.from(0.01, 'USD').getMinorUnits()).toBe(1n);
    expect(Money.from(0.07, 'USD').getMinorUnits()).toBe(7n);
    expect(Money.from(1.01, 'USD').getMinorUnits()).toBe(101n);
    expect(Money.from(1.23, 'USD').getMinorUnits()).toBe(123n);
    expect(Money.from(17.47, 'USD').getMinorUnits()).toBe(1747n);
    expect(Money.from(137.59, 'USD').getMinorUnits()).toBe(13759n);
    expect(Money.from(999.91, 'USD').getMinorUnits()).toBe(99991n);
    expect(Money.from(1000000.99, 'USD').getMinorUnits()).toBe(100000099n);
  });

  it('SGD is scaled by x100', () => {
    expect(Money.from(1.23, 'SGD').getMinorUnits()).toBe(123n);
    expect(Money.from(8765.43, 'SGD').getMinorUnits()).toBe(876543n);
  });

  it('EUR is scaled by x100', () => {
    expect(Money.from(1.23, 'EUR').getMinorUnits()).toBe(123n);
    expect(Money.from(17391.83, 'EUR').getMinorUnits()).toBe(1739183n);
  });

  it('zero maps to zero minor units', () => {
    expect(Money.from(0, 'IDR').getMinorUnits()).toBe(0n);
    expect(Money.from(0, 'USD').getMinorUnits()).toBe(0n);
  });

  it('negative values are preserved exactly', () => {
    expect(Money.from(-1.23, 'USD').getMinorUnits()).toBe(-123n);
    expect(Money.from(-137, 'IDR').getMinorUnits()).toBe(-137n);
  });

  it('does not double-scale or truncate random decimals', () => {
    const cases: Array<[number, string, bigint]> = [
      [0.09, 'USD', 9n],
      [2.5, 'SGD', 250n],
      [10.05, 'EUR', 1005n],
      [1234.56, 'USD', 123456n],
      [0.99, 'USD', 99n],
      [2483.19, 'USD', 248319n],
      [999999.99, 'USD', 99999999n],
    ];
    for (const [major, currency, minor] of cases) {
      expect(Money.from(major, currency).getMinorUnits()).toBe(minor);
    }
  });
});

describe('parseMoneyInput', () => {
  it('parses IDR grouped with dots', () => {
    expect(parseMoneyInput('1.000.000', 'IDR').getMinorUnits()).toBe(1000000n);
    expect(parseMoneyInput('Rp1.000.000', 'IDR').getMinorUnits()).toBe(
      1000000n,
    );
    expect(parseMoneyInput('1000000', 'IDR').getMinorUnits()).toBe(1000000n);
  });

  it('parses IDR grouped with commas', () => {
    expect(parseMoneyInput('1,000,000', 'IDR').getMinorUnits()).toBe(1000000n);
  });

  it('parses USD with en-US separators', () => {
    expect(
      parseMoneyInput('1,000,000.99', 'USD', 'en-US').getMinorUnits(),
    ).toBe(100000099n);
    expect(parseMoneyInput('999.91', 'USD', 'en-US').getMinorUnits()).toBe(
      99991n,
    );
    expect(parseMoneyInput('$1.23', 'USD', 'en-US').getMinorUnits()).toBe(123n);
  });

  it('parses EUR with de-DE separators', () => {
    expect(parseMoneyInput('1.234,56', 'EUR', 'de-DE').getMinorUnits()).toBe(
      123456n,
    );
    expect(parseMoneyInput('17,47', 'EUR', 'de-DE').getMinorUnits()).toBe(
      1747n,
    );
    // in de-DE a dot is a thousands separator, so 17.47 means 1747 EUR
    expect(parseMoneyInput('17.47', 'EUR', 'de-DE').getMinorUnits()).toBe(
      174700n,
    );
  });

  it('rejects malformed IDR input instead of silently truncating', () => {
    expect(() => parseMoneyInput('12a3', 'IDR')).toThrow();
  });
});

describe('Money arithmetic invariants', () => {
  it('a + b - b === a (IDR)', () => {
    const a = Money.from(1000000, 'IDR');
    const b = Money.from(500000, 'IDR');
    expect(a.add(b).subtract(b).equals(a)).toBe(true);
  });

  it('a - a === zero', () => {
    const a = Money.from(123456, 'USD');
    expect(a.subtract(a).isZero()).toBe(true);
  });

  it('round-trips parse -> minor units exactly', () => {
    expect(parseMoneyInput('1.000.000', 'IDR').getMinorUnits()).toBe(1000000n);
    expect(parseMoneyInput('137.59', 'USD', 'en-US').getMinorUnits()).toBe(
      13759n,
    );
  });
});

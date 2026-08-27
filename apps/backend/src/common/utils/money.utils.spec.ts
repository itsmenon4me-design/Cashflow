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

  it('zero maps to zero minor units', () => {
    expect(Money.from(0, 'IDR').getMinorUnits()).toBe(0n);
  });

  it('negative values are preserved exactly', () => {
    expect(Money.from(-137, 'IDR').getMinorUnits()).toBe(-137n);
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
    const a = Money.from(123456, 'IDR');
    expect(a.subtract(a).isZero()).toBe(true);
  });

  it('round-trips parse → minor units exactly', () => {
    expect(parseMoneyInput('1.000.000', 'IDR').getMinorUnits()).toBe(1000000n);
  });
});

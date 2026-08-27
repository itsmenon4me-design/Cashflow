import { describe, it, expect } from 'vitest';
import { formatCurrencyCents } from './format';

describe('formatCurrencyCents', () => {
  it('formats every IDR minor-unit regression value without a /100 transform', () => {
    const cases: Array<[bigint, string]> = [
      [BigInt(1), 'Rp1'], [BigInt(7), 'Rp7'], [BigInt(17), 'Rp17'], [BigInt(137), 'Rp137'], [BigInt(501), 'Rp501'],
      [BigInt(999), 'Rp999'], [BigInt(1000), 'Rp1.000'], [BigInt(1001), 'Rp1.001'],
      [BigInt(1234567), 'Rp1.234.567'], [BigInt(123456789), 'Rp123.456.789'],
      [BigInt(1000000), 'Rp1.000.000'],
    ];
    for (const [amount, expected] of cases) expect(formatCurrencyCents(amount, 'IDR')).toBe(expected);
  });

  it('accepts backend minor-unit strings without coercion and keeps values above Number.MAX_SAFE_INTEGER exact', () => {
    expect(formatCurrencyCents('9007199254740993', 'IDR')).toBe('Rp9.007.199.254.740.993');
  });

  it('renders zero and negative minor units without flipping the sign', () => {
    expect(formatCurrencyCents('0', 'IDR')).toBe('Rp0');
    expect(formatCurrencyCents('-1', 'IDR')).toBe('-Rp1');
    expect(formatCurrencyCents('-137', 'IDR')).toBe('-Rp137');
    expect(formatCurrencyCents('-1000000', 'IDR')).toBe('-Rp1.000.000');
  });

  it('never reintroduces the /100 artifact or IDR decimal noise', () => {
    const idr = formatCurrencyCents('1000000', 'IDR');
    expect(idr).toBe('Rp1.000.000');
    expect(idr).not.toContain('100.000.000');
    expect(idr).not.toContain('10.000');
    expect(idr).not.toContain(',');
  });

  it('preserves zero, negative values, random values, and values above Number.MAX_SAFE_INTEGER', () => {
    expect(formatCurrencyCents(BigInt(0), 'IDR')).toBe('Rp0');
    expect(formatCurrencyCents(BigInt(-137), 'IDR')).toBe('-Rp137');
    expect(formatCurrencyCents(BigInt('9876543210987654321'), 'IDR')).toBe('Rp9.876.543.210.987.654.321');
  });
});
